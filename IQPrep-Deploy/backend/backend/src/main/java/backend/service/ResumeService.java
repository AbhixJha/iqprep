package backend.service;

import backend.config.GroqProperties;
import backend.entity.Resume;
import backend.entity.User;
import backend.repository.ResumeRepository;
import backend.repository.UserRepository;
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
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ResumeService {

    private final ResumeRepository resumeRepository;
    private final UserRepository userRepository;
    private final GroqProperties groqProperties;
    private final ObjectMapper mapper = new ObjectMapper();

    private final HttpClient httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(15))
        .build();

    public Map<String, Object> analyzeResume(String email, String resumeText, String fileName) {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new RuntimeException("User not found"));

        String targetRole = user.getTargetRole() != null ? user.getTargetRole() : "Software Developer";

        if (!groqProperties.isConfigured()) {
            return Map.of(
                "error", "AI not configured",
                "detectedSkills", List.of(),
                "missingSkills", List.of(),
                "skillMatchPercent", 0,
                "suggestedQuestions", List.of(),
                "summary", "Set GROQ_API_KEY on the server to enable resume AI analysis."
            );
        }

        String prompt =
            "You are an expert HR recruiter and technical interviewer.\n\n" +
            "Analyze this resume for a candidate applying for: " + targetRole + "\n\n" +
            "RESUME TEXT:\n" + resumeText.substring(0, Math.min(resumeText.length(), 3000)) + "\n\n" +
            "Provide a detailed analysis. Respond ONLY as JSON:\n" +
            "{\n" +
            "  \"detectedSkills\": [\"skill1\", \"skill2\"],\n" +
            "  \"missingSkills\": [\"skill1\", \"skill2\"],\n" +
            "  \"skillMatchPercent\": 75,\n" +
            "  \"weakAreas\": [\"area1\", \"area2\"],\n" +
            "  \"strengths\": [\"strength1\", \"strength2\"],\n" +
            "  \"suggestedQuestions\": [\"question1\", \"question2\", \"question3\", \"question4\", \"question5\"],\n" +
            "  \"overallRating\": \"Good\",\n" +
            "  \"summary\": \"Brief 2-3 sentence analysis\",\n" +
            "  \"improvementTips\": [\"tip1\", \"tip2\", \"tip3\"]\n" +
            "}";

        try {
            String text = callGroq(prompt);
            Map<String, Object> result = mapper.readValue(text, Map.class);

            Resume resume = Resume.builder()
                .user(user)
                .fileName(fileName)
                .extractedText(resumeText.substring(0, Math.min(resumeText.length(), 5000)))
                .detectedSkills(mapper.writeValueAsString(result.getOrDefault("detectedSkills", List.of())))
                .missingSkills(mapper.writeValueAsString(result.getOrDefault("missingSkills", List.of())))
                .suggestedQuestions(mapper.writeValueAsString(result.getOrDefault("suggestedQuestions", List.of())))
                .skillMatchPercent(((Number) result.getOrDefault("skillMatchPercent", 50)).intValue())
                .weakAreas(mapper.writeValueAsString(result.getOrDefault("weakAreas", List.of())))
                .aiAnalysis(mapper.writeValueAsString(result))
                .build();

            resumeRepository.save(resume);
            result.put("resumeId", resume.getId());
            return result;

        } catch (Exception e) {
            log.warn("Resume analysis failed: {}", e.getMessage());
            return Map.of(
                "error", "Analysis failed",
                "detectedSkills", List.of(),
                "missingSkills", List.of(),
                "skillMatchPercent", 0,
                "suggestedQuestions", List.of(),
                "summary", "Could not analyze resume. Please try again."
            );
        }
    }

    public Map<String, Object> getReadinessScore(String email) {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new RuntimeException("User not found"));

        double avgScore = user.getAverageScore() != null ? user.getAverageScore() : 0.0;
        int totalSessions = user.getTotalSessions() != null ? user.getTotalSessions() : 0;
        int streak = user.getStreakDays() != null ? user.getStreakDays() : 0;

        // Calculate readiness score (0-100)
        double scoreComponent = Math.min(avgScore * 10, 40); // max 40 points
        double sessionsComponent = Math.min(totalSessions * 2, 30); // max 30 points
        double streakComponent = Math.min(streak * 3, 20); // max 20 points
        double consistencyBonus = totalSessions >= 10 ? 10 : 0; // bonus 10 points

        int readinessScore = (int) (scoreComponent + sessionsComponent + streakComponent + consistencyBonus);
        readinessScore = Math.min(readinessScore, 100);

        String status = readinessScore >= 70 ? "Ready" :
                       readinessScore >= 40 ? "Improving" : "Not Ready";

        String statusColor = readinessScore >= 70 ? "#34d399" :
                            readinessScore >= 40 ? "#fbbf24" : "#f87171";

        String message = readinessScore >= 70 ?
            "You're well prepared! Keep practicing to maintain your edge." :
            readinessScore >= 40 ?
            "Good progress! Focus on weak areas to get interview-ready." :
            "Keep practicing daily! Consistency is the key to improvement.";

        return Map.of(
            "readinessScore", readinessScore,
            "status", status,
            "statusColor", statusColor,
            "message", message,
            "avgScore", avgScore,
            "totalSessions", totalSessions,
            "streak", streak
        );
    }

    private String callGroq(String prompt) throws Exception {
        String requestJson = mapper.writeValueAsString(Map.of(
            // Changed to 8b model which has much higher free-tier Token Per Minute limits
            "model", "llama-3.1-8b-instant",
            "messages", List.of(
                Map.of("role", "system", "content", "You are an expert HR recruiter. Always respond with valid JSON only."),
                Map.of("role", "user", "content", prompt)
            ),
            "temperature", 0.3,
            "max_tokens", 2000
        ));

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(groqProperties.getApiUrl()))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + groqProperties.getApiKey())
            .timeout(Duration.ofSeconds(30))
            .POST(HttpRequest.BodyPublishers.ofString(requestJson))
            .build();

        int maxRetries = 3;
        int retryDelayMs = 2000; // start with 2 seconds

        for (int i = 0; i < maxRetries; i++) {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                JsonNode root = mapper.readTree(response.body());
                return root.path("choices").get(0)
                    .path("message").path("content").asText()
                    .replaceAll("```json", "").replaceAll("```", "").trim();
            } else if (response.statusCode() == 429) {
                log.warn("Resume Groq 429, retry {}/{}", i + 1, maxRetries);
                if (i == maxRetries - 1) {
                    throw new RuntimeException("Groq API error: 429 - " + response.body());
                }
                Thread.sleep(retryDelayMs);
                retryDelayMs *= 2; // exponential backoff (2s, 4s, 8s)
            } else {
                throw new RuntimeException("Groq API error: " + response.statusCode() + " - " + response.body());
            }
        }
        
        throw new RuntimeException("Groq API failed after retries");
    }
}