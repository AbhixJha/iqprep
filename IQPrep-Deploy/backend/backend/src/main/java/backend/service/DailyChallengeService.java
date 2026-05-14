package backend.service;

import backend.entity.DailyChallenge;
import backend.entity.User;
import backend.repository.DailyChallengeRepository;
import backend.repository.UserRepository;
import backend.config.GroqProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class DailyChallengeService {

    private final DailyChallengeRepository challengeRepository;
    private final UserRepository userRepository;
    private final GroqProperties groqProperties;
    private final ObjectMapper mapper = new ObjectMapper();

    private final HttpClient httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(15))
        .build();

    public Map<String, Object> getTodaysChallenge(String email) {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new RuntimeException("User not found"));

        Optional<DailyChallenge> existing = challengeRepository
            .findByUserAndChallengeDate(user, LocalDate.now());

        if (existing.isPresent()) {
            return buildChallengeResponse(existing.get());
        }

        String targetRole = user.getTargetRole() != null ? user.getTargetRole() : "Software Developer";
        String question = generateDailyQuestion(targetRole);

        DailyChallenge challenge = DailyChallenge.builder()
            .user(user)
            .question(question)
            .completed(false)
            .build();

        challenge = challengeRepository.save(challenge);
        return buildChallengeResponse(challenge);
    }

    // New overload: accepts pre-evaluated score from frontend (via /api/evaluate)
    public Map<String, Object> submitChallenge(String email, Long challengeId,
                                                String answer, Double preScore, String preFeedback) {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new RuntimeException("User not found"));

        DailyChallenge challenge = challengeRepository.findById(challengeId)
            .orElseThrow(() -> new RuntimeException("Challenge not found"));

        double score;
        String feedback;

        if (preScore != null && preFeedback != null && !preFeedback.isEmpty()) {
            // Use the score already computed by /api/evaluate on the frontend
            score    = preScore;
            feedback = preFeedback;
        } else {
            // Fallback: evaluate here if frontend didn't send one
            feedback = evaluateAnswer(challenge.getQuestion(), answer);
            score    = extractScore(feedback);
        }

        challenge.setUserAnswer(answer);
        challenge.setAiFeedback(feedback);
        challenge.setScore(score);
        challenge.setCompleted(true);
        challengeRepository.save(challenge);

        long totalCompleted = challengeRepository.countByUserAndCompletedTrue(user);

        return Map.of(
            "score",          score,
            "feedback",       feedback,
            "totalCompleted", totalCompleted,
            "message",        score >= 7 ? "Excellent! 🎉" : "Good effort! Keep practicing!"
        );
    }

    // Keep old signature for backward compat
    public Map<String, Object> submitChallenge(String email, Long challengeId, String answer) {
        return submitChallenge(email, challengeId, answer, null, null);
    }

    private String generateDailyQuestion(String targetRole) {
        if (!groqProperties.isConfigured()) {
            return "Explain the difference between process and thread. When would you use each?";
        }
        try {
            String prompt = "Generate ONE challenging interview question for a " + targetRole +
                " candidate. Make it practical. Return ONLY the question text, nothing else.";

            String requestJson = mapper.writeValueAsString(Map.of(
                "model", "llama-3.1-8b-instant",
                "messages", List.of(Map.of("role", "user", "content", prompt)),
                "temperature", 0.9,
                "max_tokens", 200
            ));

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(groqProperties.getApiUrl()))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + groqProperties.getApiKey())
                .timeout(Duration.ofSeconds(20))
                .POST(HttpRequest.BodyPublishers.ofString(requestJson))
                .build();

            int maxRetries = 3;
            int retryDelayMs = 2000;
            for (int i = 0; i < maxRetries; i++) {
                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() == 200) {
                    JsonNode root = mapper.readTree(response.body());
                    return root.path("choices").get(0).path("message").path("content").asText().trim();
                } else if (response.statusCode() == 429) {
                    if (i == maxRetries - 1) break;
                    Thread.sleep(retryDelayMs);
                    retryDelayMs *= 2;
                } else {
                    break;
                }
            }
            throw new RuntimeException("API Failed");

        } catch (Exception e) {
            return "Explain the difference between process and thread. When would you use each?";
        }
    }

    private String evaluateAnswer(String question, String answer) {
        if (!groqProperties.isConfigured()) {
            return "Score: 5/10. Good attempt! Keep practicing.";
        }
        try {
            String prompt = "Evaluate this interview answer. Give score like 'Score: 7/10' at start. 2-3 sentences. Q: " + question + " A: " + answer;

            String requestJson = mapper.writeValueAsString(Map.of(
                "model", "llama-3.1-8b-instant",
                "messages", List.of(Map.of("role", "user", "content", prompt)),
                "temperature", 0.3,
                "max_tokens", 300
            ));

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(groqProperties.getApiUrl()))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + groqProperties.getApiKey())
                .timeout(Duration.ofSeconds(20))
                .POST(HttpRequest.BodyPublishers.ofString(requestJson))
                .build();

            int maxRetries = 3;
            int retryDelayMs = 2000;
            for (int i = 0; i < maxRetries; i++) {
                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() == 200) {
                    JsonNode root = mapper.readTree(response.body());
                    return root.path("choices").get(0).path("message").path("content").asText().trim();
                } else if (response.statusCode() == 429) {
                    if (i == maxRetries - 1) break;
                    Thread.sleep(retryDelayMs);
                    retryDelayMs *= 2;
                } else {
                    break;
                }
            }
            throw new RuntimeException("API Failed");

        } catch (Exception e) {
            return "Score: 5/10. Good attempt! Keep practicing.";
        }
    }

    private double extractScore(String feedback) {
        try {
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("Score:\\s*(\\d+)").matcher(feedback);
            if (m.find()) return Double.parseDouble(m.group(1));
        } catch (Exception ignored) {}
        return 5.0;
    }

    private Map<String, Object> buildChallengeResponse(DailyChallenge c) {
        Map<String, Object> res = new HashMap<>();
        res.put("id",        c.getId());
        res.put("question",  c.getQuestion());
        res.put("completed", c.getCompleted());
        res.put("score",     c.getScore());
        res.put("feedback",  c.getAiFeedback());
        res.put("date",      c.getChallengeDate().toString());
        return res;
    }
}