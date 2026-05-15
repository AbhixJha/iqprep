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
import java.util.List;
import java.util.Map;
import java.util.Random;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class GeminiService {

    @Value("${gemini.api.key}")
    private String apiKey;

    @Value("${gemini.api.url}")
    private String apiUrl;

    private final HttpClient httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(15))
        .build();

    private final ObjectMapper mapper = new ObjectMapper();
    private final Random random = new Random();

    private String callAI(String prompt) throws Exception {
        String requestJson = mapper.writeValueAsString(Map.of(
            "model", "llama-3.3-70b-versatile",
            "messages", List.of(
                Map.of("role", "system", "content",
                    "You are an expert technical interviewer. You MUST respond with ONLY valid JSON. Your response must start with `{` or `[` and end with `}` or `]`. Do NOT under any circumstances output markdown formatting, ```json or ``` blocks. Just output raw JSON."),
                Map.of("role", "user", "content", prompt)
            ),
            "temperature", 0.7,
            "max_tokens", 3000,
            "top_p", 0.95
        ));

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(apiUrl))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + apiKey)
            .timeout(Duration.ofSeconds(30))
            .POST(HttpRequest.BodyPublishers.ofString(requestJson))
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        log.info("AI STATUS: {}", response.statusCode());

        if (response.statusCode() != 200) {
            log.error("AI ERROR: {}", response.body());
            throw new RuntimeException("AI error: " + response.statusCode());
        }

        JsonNode root = mapper.readTree(response.body());
        String content = root.path("choices").get(0)
            .path("message").path("content").asText().trim();

        // Strip markdown fences if model still adds them
        content = content.replaceAll("(?s)```json\\s*", "").replaceAll("```\\s*", "").trim();

        // Extract JSON object or array if there's surrounding text
        int startObj = content.indexOf('{');
        int startArr = content.indexOf('[');
        int start = startObj;
        if (startArr >= 0 && (startObj < 0 || startArr < startObj)) start = startArr;

        int endObj = content.lastIndexOf('}');
        int endArr = content.lastIndexOf(']');
        int end = endObj;
        if (endArr >= 0 && (endObj < 0 || endArr > endObj)) end = endArr;

        if (start >= 0 && end > start) {
            content = content.substring(start, end + 1);
        }

        log.info("AI RAW RESPONSE: {}", content.substring(0, Math.min(200, content.length())));
        return content;
    }

    @Retryable(value = Exception.class, maxAttempts = 3, backoff = @Backoff(delay = 1000))
    public Map<String, Object> evaluateAnswer(String question, String answer,
                                               String category, String difficulty,
                                               String personality, String behaviorMetrics,
                                               List<String> previousWeaknesses) {
        String tone = "strict".equals(personality) ?
            "You are a VERY strict senior interviewer at Google. Be highly critical." :
            "friendly".equals(personality) ?
            "You are a friendly mentor interviewer. Be encouraging but honest." :
            "You are a neutral professional interviewer. Be objective and fair.";

        String behaviorContext = (behaviorMetrics != null && !behaviorMetrics.isEmpty()) 
            ? "\nBEHAVIORAL/PHYSICAL ML METRICS RECORDED DURING ANSWER: " + behaviorMetrics + " (Use these metrics to influence the feedback and the behavioral aspects of the score!)"
            : "";

        String weaknessContext = (previousWeaknesses != null && !previousWeaknesses.isEmpty())
            ? "\nHISTORICAL WEAKNESSES: " + String.join(", ", previousWeaknesses) + " (Check if they improved on these!)"
            : "";

        String prompt =
            tone + " Evaluate the candidate fairly and holistically.\n\n" +
            "QUESTION: " + question + "\n" +
            "CANDIDATE ANSWER: " + answer + "\n" +
            "CATEGORY: " + category + " | DIFFICULTY: " + difficulty + behaviorContext + weaknessContext + "\n\n" +
            "CRITICAL INSTRUCTIONS FOR SCORING:\n" +
            "1. Score 0-10 accurately based on completeness and logic. Do not default to 5.\n" +
            "2. Analyze the 'rootCause' of any failure (e.g. 'Lack of theoretical concept', 'Poor coding execution').\n" +
            "3. Evaluate 'confidenceInsight' by mapping the behavioral metrics (WPM/Hesitation) against their factual accuracy (e.g. 'Highly confident but factually incorrect').\n" +
            "4. Track the explicit 'structure' of the answer.\n" +
            "5. Based on the answer, generate a 'followUpQuestion' logically transitioning deeper, or an 'interruptPrompt' if they rambled.\n" +
            "6. Populate an array of 'suggestedLearningPath' topics.\n\n" +
            "Respond with ONLY this JSON:\n" +
            "{\"score\":7,\"feedback\":\"specific feedback here\",\"strengths\":[\"strength1\"],\"improvements\":[\"improvement1\"],\"betterAnswer\":\"model answer here\",\"accuracyScore\":7,\"clarityScore\":7,\"completenessScore\":7,\"rootCause\":\"Missing edge cases\",\"confidenceInsight\":\"Confident and accurate\",\"interruptPrompt\":\"Wait, could you clarify X?\",\"followUpQuestion\":\"How would you scale this to 10k users?\",\"suggestedLearningPath\":[\"Topic 1\",\"Topic 2\"],\"structure\":{\"hasIntro\":true,\"hasExplanation\":true,\"hasExample\":false,\"hasConclusion\":true}}";

        try {
            String text = callAI(prompt);
            Map<String, Object> result = mapper.readValue(text, Map.class);
            // Validate score is actually present and reasonable
            Object scoreObj = result.get("score");
            if (scoreObj == null) throw new RuntimeException("No score in response");
            int score = ((Number) scoreObj).intValue();
            log.info("EVAL SCORE: {} for answer length: {}", score, answer.length());
            return result;
        } catch (Exception e) {
            log.error("EVAL ERROR: {}", e.getMessage());
            // Smarter fallback based on answer quality
            int fallbackScore = computeFallbackScore(answer);
            Map<String, Object> fallback = new java.util.HashMap<>();
            fallback.put("score", fallbackScore);
            fallback.put("feedback", "AI evaluation temporarily unavailable. Score estimated from answer length and content.");
            fallback.put("strengths", List.of("Answer was submitted"));
            fallback.put("improvements", List.of("Retry for real AI feedback"));
            fallback.put("betterAnswer", "");
            fallback.put("accuracyScore", fallbackScore);
            fallback.put("clarityScore", fallbackScore);
            fallback.put("completenessScore", fallbackScore);
            fallback.put("rootCause", "Execution error");
            fallback.put("confidenceInsight", "Unknown");
            fallback.put("interruptPrompt", "");
            fallback.put("followUpQuestion", "");
            fallback.put("suggestedLearningPath", List.of());
            fallback.put("structure", Map.of("hasIntro", false, "hasExplanation", false, "hasExample", false, "hasConclusion", false));
            return fallback;
        }
    }

    private int computeFallbackScore(String answer) {
        if (answer == null || answer.trim().isEmpty()) return 0;
        int words = answer.trim().split("\\s+").length;
        if (words < 5)  return 0;
        if (words < 15) return 2;
        if (words < 40) return 4;
        if (words < 80) return 6;
        return 8;
    }

    @Retryable(value = Exception.class, maxAttempts = 3, backoff = @Backoff(delay = 1000))
    public List<Map<String, Object>> generateQuestions(String category,
                                                        String difficulty,
                                                        int count,
                                                        String targetRole) {

        String[] techTopics = {"Java Collections","OOP Concepts","Design Patterns","System Design",
            "DSA Arrays","DSA Trees","DSA Graphs","Multithreading","JVM Internals",
            "Spring Boot","Microservices","Database Indexing","SQL Joins","REST APIs","SOLID Principles"};
        String[] hrTopics = {"Leadership","Conflict Resolution","Teamwork","Time Management",
            "Failure & Learning","Career Goals","Adaptability","Communication","Problem Solving","Initiative"};
        String[] aptTopics = {"Speed & Distance","Profit & Loss","Probability","Permutations",
            "Set Theory","Number Series","Coding & Decoding","Blood Relations","Syllogisms","Work & Time"};

        String topicHint = "";
        if ("technical".equals(category)) {
            topicHint = "Focus on: " + techTopics[random.nextInt(techTopics.length)] + ", " + techTopics[random.nextInt(techTopics.length)];
        } else if ("hr".equals(category)) {
            topicHint = "Focus on: " + hrTopics[random.nextInt(hrTopics.length)] + ", " + hrTopics[random.nextInt(hrTopics.length)];
        } else if ("aptitude".equals(category)) {
            topicHint = "Focus on: " + aptTopics[random.nextInt(aptTopics.length)] + ", " + aptTopics[random.nextInt(aptTopics.length)];
        }

        String prompt =
            "Generate " + count + " UNIQUE interview questions for " + targetRole + ".\n" +
            "Category: " + category + " | Difficulty: " + difficulty + "\n" +
            topicHint + "\n" +
            "Seed: " + java.util.UUID.randomUUID().toString() + "_" + System.currentTimeMillis() + "_" + random.nextInt(999999) + "\n\n" +
            "Rules: Generating completely random and diverse topics is absolute highest priority. NEVER generate the exact same set of questions twice. Pick obscure but realistic variations.\n\n" +
            "Respond with ONLY this JSON array (no other text):\n" +
            "[{\"question\":\"full question text\",\"tags\":[\"topic\",\"difficulty\"]}]";

        try {
            String text = callAI(prompt);
            // Extract array if wrapped
            int start = text.indexOf('[');
            int end   = text.lastIndexOf(']');
            if (start >= 0 && end > start) text = text.substring(start, end + 1);
            return mapper.readValue(text, List.class);
        } catch (Exception e) {
            System.out.println("QUESTIONS ERROR: " + e.getMessage());
            return getFallbackQuestions(category);
        }
    }

    private List<Map<String, Object>> getFallbackQuestions(String category) {
        if ("technical".equals(category)) {
            return List.of(
                Map.of("question","Explain HashMap vs ConcurrentHashMap. When use each?","tags",List.of("Java","Collections")),
                Map.of("question","Time complexity of QuickSort best/average/worst case?","tags",List.of("DSA","Sorting")),
                Map.of("question","Explain SOLID principles with Java examples.","tags",List.of("OOP","Design")),
                Map.of("question","Design a parking lot system. Classes and relationships?","tags",List.of("System Design")),
                Map.of("question","What is deadlock? Prevent it in Java?","tags",List.of("Multithreading"))
            );
        } else if ("hr".equals(category)) {
            return List.of(
                Map.of("question","Tell me about a time you learned a new technology quickly.","tags",List.of("Adaptability")),
                Map.of("question","Describe disagreeing with your team lead. How handled?","tags",List.of("Conflict Resolution")),
                Map.of("question","Your most challenging project and how you succeeded?","tags",List.of("Problem Solving")),
                Map.of("question","Example of going above and beyond expectations?","tags",List.of("Initiative")),
                Map.of("question","Describe a failure. What did you learn?","tags",List.of("Growth Mindset"))
            );
        } else if ("aptitude".equals(category)) {
            return List.of(
                Map.of("question","Train 200m long passes bridge 300m long in 25s. Speed in km/h?","tags",List.of("Speed","Math")),
                Map.of("question","Next number: 1, 4, 9, 16, 25, 36, ?","tags",List.of("Number Series")),
                Map.of("question","20% profit on ₹500 cost. Selling price?","tags",List.of("Profit & Loss")),
                Map.of("question","70 people: 37 like coffee, 52 like tea, each likes one. Both?","tags",List.of("Set Theory")),
                Map.of("question","If COMPUTER = RFNQBSDO, how is MOBILE coded?","tags",List.of("Coding"))
            );
        } else {
            return List.of(
                Map.of("question","Design real-time notification system like WhatsApp.","tags",List.of("System Design")),
                Map.of("question","Explain complex technical concept to non-technical person.","tags",List.of("Communication")),
                Map.of("question","Pipe fills tank in 6h, another empties in 8h. Both open — when full?","tags",List.of("Aptitude")),
                Map.of("question","Difference between authentication and authorization?","tags",List.of("Security")),
                Map.of("question","Describe your ideal work environment.","tags",List.of("Culture Fit"))
            );
        }
    }

    public String handleChat(String message, String context, String mode, String interviewTopic) {
        String systemPrompt = "You are iqAI, an advanced AI interview coach and interviewer. Keep answers concise, helpful, and formatted with markdown when useful. ";
        if ("interviewer".equals(mode)) {
            systemPrompt += "You are currently in INTERVIEWER mode testing the candidate on: " + interviewTopic + ". Act as a realistic technical interviewer. Ask challenging questions and evaluate their responses. " + context;
        } else {
            systemPrompt += "You are currently in COACH mode. Help the user prepare for interviews. Give them tips, feedback, and answer their questions. " + context;
        }
        
        String prompt = systemPrompt + "\n\nUser Message: " + message;
        
        try {
            // Note: We use the existing callAI which forces JSON format. Wait, callAI currently enforces JSON in the system prompt.
            // I need a separate call method for raw text, or I can just ask it to return text but callAI says "You MUST respond with ONLY valid JSON".
            // Let me create a quick textCallAI.
            return textCallAI(prompt);
        } catch (Exception e) {
            return "I'm having trouble connecting right now. Please try again later! (Error: " + e.getMessage() + ")";
        }
    }

    private String textCallAI(String prompt) throws Exception {
        String requestJson = mapper.writeValueAsString(Map.of(
            "model", "llama-3.3-70b-versatile",
            "messages", List.of(
                Map.of("role", "system", "content", "You are iqAI, an advanced AI interview coach. Respond normally with helpful markdown text."),
                Map.of("role", "user", "content", prompt)
            ),
            "temperature", 0.7,
            "max_tokens", 1000
        ));

        HttpRequest request = HttpRequest.newBuilder()
            .uri(java.net.URI.create(apiUrl))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + apiKey)
            .timeout(Duration.ofSeconds(30))
            .POST(HttpRequest.BodyPublishers.ofString(requestJson))
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new RuntimeException("AI error: " + response.statusCode());
        }

        com.fasterxml.jackson.databind.JsonNode root = mapper.readTree(response.body());
        return root.path("choices").get(0).path("message").path("content").asText().trim();
    }
}