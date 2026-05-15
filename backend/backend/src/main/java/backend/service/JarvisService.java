package backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

@Service
public class JarvisService {

    @Value("${gemini.api.key}")
    private String apiKey;

    private final HttpClient httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(15))
        .build();

    private final ObjectMapper mapper = new ObjectMapper();

    public String chat(String message, String context, String userName, String mode, String interviewTopic) {

        String systemPrompt;

        if ("interviewer".equals(mode) && interviewTopic != null && !interviewTopic.isEmpty()) {
            // ── INTERVIEW MODE — stays on topic ──
            systemPrompt =
                "You are JARVIS acting as a strict professional interviewer. " +
                "You are interviewing " + userName + " for: " + interviewTopic + ". " +
                "IMPORTANT RULES:\n" +
                "1. ALWAYS stay on the topic: " + interviewTopic + "\n" +
                "2. Ask ONE interview question at a time\n" +
                "3. After user answers, give brief feedback then ask next question\n" +
                "4. Never go off topic\n" +
                "5. Keep responses under 3 sentences\n" +
                "6. Start by asking the first interview question immediately\n" +
                "User context: " + context;
        } else {
            // ── NORMAL COACH MODE ──
            systemPrompt =
                "You are JARVIS, an intelligent AI interview coach built into IQPrep platform. " +
                "You are helpful, encouraging, and expert in interview preparation. " +
                "You know about Java, DSA, System Design, HR interviews, and aptitude tests. " +
                "Keep responses concise (2-4 sentences max) unless detailed explanation is needed. " +
                "Be friendly and motivating. Address the user by name when appropriate. " +
                "User's name: " + userName + ". " +
                "User context: " + context + ". " +
                "If user asks you to act as interviewer, ask them WHAT TOPIC before starting. " +
                "Never break character. You are JARVIS from IQPrep, not any other AI.";
        }

        try {
            String requestJson = mapper.writeValueAsString(Map.of(
                // Changed to 8b model which has much higher free-tier Token Per Minute limits
                "model", "llama-3.1-8b-instant",
                "messages", List.of(
                    Map.of("role", "system", "content", systemPrompt),
                    Map.of("role", "user", "content", message)
                ),
                "temperature", 0.7,
                "max_tokens", 400
            ));

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://api.groq.com/openai/v1/chat/completions"))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .timeout(Duration.ofSeconds(25))
                .POST(HttpRequest.BodyPublishers.ofString(requestJson))
                .build();

            int maxRetries = 3;
            int retryDelayMs = 2000;

            for (int i = 0; i < maxRetries; i++) {
                HttpResponse<String> response = httpClient.send(
                    request, HttpResponse.BodyHandlers.ofString()
                );

                if (response.statusCode() == 200) {
                    JsonNode root = mapper.readTree(response.body());
                    return root.path("choices").get(0)
                        .path("message").path("content").asText();
                } else if (response.statusCode() == 429) {
                    System.out.println("JARVIS Groq rate limit hit (429). Retrying in " + retryDelayMs + "ms...");
                    if (i == maxRetries - 1) {
                        return "I'm receiving too many requests right now. Please try again in a minute!";
                    }
                    Thread.sleep(retryDelayMs);
                    retryDelayMs *= 2;
                } else {
                    System.out.println("JARVIS ERROR: HTTP " + response.statusCode());
                    return "I'm having trouble connecting right now. Please try again!";
                }
            }
            return "I'm having trouble connecting right now. Please try again!";

        } catch (Exception e) {
            System.out.println("JARVIS ERROR: " + e.getMessage());
            return "Sorry " + userName + ", I'm having a small glitch! Try asking me again.";
        }
    }
}