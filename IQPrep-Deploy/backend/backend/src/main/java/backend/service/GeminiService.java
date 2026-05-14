package backend.service;

import backend.config.GroqProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.stream.Collectors;

/**
 * Interview AI via Groq (OpenAI-compatible chat completions).
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class GeminiService {

    private final GroqProperties groq;

    private final HttpClient httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(15))
        .build();

    private final ObjectMapper mapper = new ObjectMapper();
    private final Random random = new Random();

    private HttpRequest.Builder groqRequestBase(Duration timeout) {
        if (!groq.isConfigured()) {
            throw new IllegalStateException("GROQ_API_KEY is not configured");
        }
        return HttpRequest.newBuilder()
            .uri(URI.create(groq.getApiUrl()))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + groq.getApiKey())
            .timeout(timeout);
    }

    private String postGroqJson(String body) throws Exception {
        HttpRequest request = groqRequestBase(Duration.ofSeconds(15))
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() == 429) {
            log.warn("Groq rate limit (429)");
            throw new RuntimeException("RATE_LIMIT");
        }
        if (response.statusCode() != 200) {
            log.error("Groq HTTP {} — body prefix: {}", response.statusCode(),
                response.body() == null ? "" : response.body().substring(0, Math.min(120, response.body().length())));
            throw new RuntimeException("AI error: " + response.statusCode());
        }
        JsonNode root = mapper.readTree(response.body());
        JsonNode choices = root.path("choices");
        if (!choices.isArray() || choices.isEmpty()) {
            throw new RuntimeException("AI response missing choices");
        }
        return choices.get(0).path("message").path("content").asText("").trim();
    }

    private String callAiJsonOnly(String userPrompt) throws Exception {
        String requestJson = mapper.writeValueAsString(Map.of(
            "model", "llama-3.3-70b-versatile",
            "messages", List.of(
                Map.of("role", "system", "content",
                    "You are an expert hiring panel lead. You MUST respond with ONLY valid JSON. "
                        + "Start with `{` or `[` and end with `}` or `]`. No markdown fences, no prose."),
                Map.of("role", "user", "content", userPrompt)
            ),
            "temperature", 0.55,
            "max_tokens", 3800,
            "top_p", 0.92
        ));

        String content = postGroqJson(requestJson);
        content = content.replaceAll("(?s)```json\\s*", "").replaceAll("```\\s*", "").trim();

        int startObj = content.indexOf('{');
        int startArr = content.indexOf('[');
        int start = startObj;
        if (startArr >= 0 && (startObj < 0 || startArr < startObj)) {
            start = startArr;
        }
        int endObj = content.lastIndexOf('}');
        int endArr = content.lastIndexOf(']');
        int end = endObj;
        if (endArr >= 0 && (endObj < 0 || endArr > endObj)) {
            end = endArr;
        }
        if (start >= 0 && end > start) {
            content = content.substring(start, end + 1);
        }
        if (log.isDebugEnabled()) {
            log.debug("AI JSON prefix: {}", content.substring(0, Math.min(160, content.length())));
        }
        return content;
    }

    @Retryable(value = Exception.class, maxAttempts = 3, backoff = @Backoff(delay = 1200, multiplier = 1.8))
    public Map<String, Object> evaluateAnswer(String question, String answer,
                                               String category, String difficulty,
                                               String personality, String behaviorMetrics,
                                               List<String> previousWeaknesses) {
        if (!groq.isConfigured()) {
            return buildEvaluateFallback(answer, "AI is not configured (missing GROQ_API_KEY).");
        }

        String tone = "strict".equals(personality)
            ? "You are a VERY strict staff+ engineer interviewer. Be precise and demanding. Penalize vagueness and hand-waving."
            : "friendly".equals(personality)
            ? "You are a friendly but honest mentor interviewer. Be encouraging but accurate. Point out gaps constructively."
            : "You are a neutral professional interviewer. Be objective, fair, and precise. Evaluate based on merit alone.";

        String behaviorContext = (behaviorMetrics != null && !behaviorMetrics.isBlank())
            ? "\nDELIVERY / BEHAVIOR SIGNALS (from app, not clinical): " + behaviorMetrics
            + "\nUse only as light context for tone of feedback — never invent medical diagnoses.\n"
            : "";

        String weaknessContext = (previousWeaknesses != null && !previousWeaknesses.isEmpty())
            ? "\nPRIOR WEAK AREAS TO CHECK: " + String.join("; ", previousWeaknesses) + "\n"
            : "";

        String diffHint = switch (difficulty == null ? "medium" : difficulty.toLowerCase()) {
            case "easy" -> "Bar: junior/fresher level. Reward clear fundamentals and basic concepts. Penalize hand-waving and non-answers.";
            case "hard" -> "Bar: senior/staff level. Expect trade-offs, edge cases, operational concerns, and nuanced thinking. High bar.";
            default -> "Bar: mid-level/senior level. Expect clear structure, concrete examples, and correct core logic.";
        };

        String prompt = tone + "\n" + diffHint + "\n\n"
            + "QUESTION:\n" + question + "\n\n"
            + "CANDIDATE ANSWER:\n" + answer + "\n\n"
            + "META: category=" + category + " difficulty=" + difficulty + behaviorContext + weaknessContext + "\n\n"
            + "SCORING RUBRIC (0–10 scale, use FULL RANGE):\n"
            + "0–1: Empty, gibberish, completely incoherent, or refuses to answer.\n"
            + "2–3: Minimal understanding. Mostly wrong, incoherent, or severely incomplete. Shows little effort.\n"
            + "4–5: Weak understanding. Partially correct but with major gaps, confusion, or unclear explanation.\n"
            + "6–7: Reasonable understanding. Mostly correct, decent explanation, but lacks depth or minor errors present.\n"
            + "8–9: Strong understanding. Well-articulated, correct, includes examples, shows depth. Few/no errors.\n"
            + "10: Exceptional. Comprehensive, insightful, considers edge cases/trade-offs, professional-quality answer.\n\n"
            + "EVALUATION CRITERIA:\n"
            + "• Technical Accuracy: Is the core content correct? Are there factual errors or misconceptions?\n"
            + "• Depth of Understanding: Does the answer show superficial or deep knowledge? Are trade-offs discussed?\n"
            + "• Communication Clarity: Is it well-structured, easy to follow, logically organized?\n"
            + "• Completeness: Does it answer the full question? Are examples provided? Are edge cases mentioned?\n"
            + "• Confidence: Does the candidate sound certain or uncertain? Are caveats appropriate?\n\n"
            + "IMPORTANT RULES:\n"
            + "1) DO NOT cluster scores around 5–7. Use the FULL 0–10 range.\n"
            + "2) Differentiate clearly: bad answers get 0–4, mediocre get 5–6, good get 7–8, excellent get 9–10.\n"
            + "3) accuracyScore, clarityScore, completenessScore: each 0–10, reflecting their respective criteria.\n"
            + "4) Compute overall score as roughly: (2*accuracy + clarity + completeness) / 4 (with adjustments).\n"
            + "5) strengths: array of 2–4 concrete, specific strengths from the answer.\n"
            + "6) improvements: array of 2–4 concrete, specific areas to improve.\n"
            + "7) betterAnswer: concise model answer (2–3 sentences, not an essay).\n"
            + "8) followUpQuestion: one sharp follow-up question an interviewer would ask.\n"
            + "9) structure booleans: reflect if the answer actually has intro/explanation/example/conclusion.\n"
            + "10) If answer is empty/single word/obvious placeholder, score MUST be ≤2.\n\n"
            + "Respond with ONLY this JSON object (no markdown, no prose):\n"
            + "{\"score\":7,\"feedback\":\"Feedback here\",\"strengths\":[\"strength1\",\"strength2\"],\"improvements\":[\"improve1\",\"improve2\"],\"betterAnswer\":\"Better answer here\","
            + "\"accuracyScore\":7,\"clarityScore\":7,\"completenessScore\":7,\"rootCause\":\"Root cause if weak\","
            + "\"confidenceInsight\":\"Confidence analysis\",\"interruptPrompt\":\"Interrupt or probe\",\"followUpQuestion\":\"What's next?\","
            + "\"suggestedLearningPath\":[\"topic1\",\"topic2\"],"
            + "\"structure\":{\"hasIntro\":true,\"hasExplanation\":true,\"hasExample\":true,\"hasConclusion\":true}}";

        try {
            String text = callAiJsonOnly(prompt);
            @SuppressWarnings("unchecked")
            Map<String, Object> result = mapper.readValue(text, Map.class);
            
            // Validate response
            result = validateAndSanitizeEvaluationResponse(result, answer);
            log.info("Evaluation score={} (answerChars={})", result.get("score"), answer != null ? answer.length() : 0);
            return result;
        } catch (Exception e) {
            log.error("evaluateAnswer failed: {}", e.getMessage(), e);
            return buildEvaluateFallback(answer, "AI evaluation temporarily unavailable.");
        }
    }

    /**
     * Validate and sanitize the AI evaluation response to ensure quality and consistency.
     */
    private Map<String, Object> validateAndSanitizeEvaluationResponse(Map<String, Object> response, String answer) {
        // Ensure score is valid (0-10 integer)
        Object scoreObj = response.get("score");
        if (scoreObj == null || !(scoreObj instanceof Number)) {
            log.warn("Invalid score in response, using fallback");
            return buildEvaluateFallback(answer, "Evaluation response invalid.");
        }
        
        int score = ((Number) scoreObj).intValue();
        if (score < 0 || score > 10) {
            log.warn("Score out of range: {}, clamping to 0-10", score);
            score = Math.max(0, Math.min(10, score));
            response.put("score", score);
        }
        
        // If answer is empty/very short/placeholder, force low score
        if (answer == null || answer.trim().isEmpty() || answer.trim().length() < 5) {
            if (score > 2) {
                log.warn("Empty/minimal answer but score is {}, forcing to 1", score);
                score = 1;
                response.put("score", score);
            }
        }
        
        // Ensure sub-scores are valid
        response.putIfAbsent("accuracyScore", score);
        response.putIfAbsent("clarityScore", score);
        response.putIfAbsent("completenessScore", score);
        
        clampScore(response, "accuracyScore");
        clampScore(response, "clarityScore");
        clampScore(response, "completenessScore");
        
        // Ensure arrays exist
        response.putIfAbsent("strengths", List.of("Answer submitted"));
        response.putIfAbsent("improvements", List.of("Keep practicing"));
        response.putIfAbsent("suggestedLearningPath", List.of());
        response.putIfAbsent("feedback", "");
        response.putIfAbsent("betterAnswer", "");
        response.putIfAbsent("rootCause", "");
        response.putIfAbsent("confidenceInsight", "");
        response.putIfAbsent("interruptPrompt", "");
        response.putIfAbsent("followUpQuestion", "");
        
        // Ensure structure exists
        if (!(response.get("structure") instanceof Map)) {
            response.put("structure", Map.of(
                "hasIntro", false,
                "hasExplanation", false,
                "hasExample", false,
                "hasConclusion", false
            ));
        }
        
        return response;
    }

    /**
     * Clamp a score field to 0-10 range.
     */
    private void clampScore(Map<String, Object> response, String fieldName) {
        Object scoreObj = response.get(fieldName);
        if (scoreObj instanceof Number) {
            int score = ((Number) scoreObj).intValue();
            score = Math.max(0, Math.min(10, score));
            response.put(fieldName, score);
        }
    }

    private Map<String, Object> buildEvaluateFallback(String answer, String feedback) {
        int fallbackScore = computeFallbackScore(answer);
        int accuracyScore = fallbackScore;
        int clarityScore = fallbackScore;
        int completenessScore = fallbackScore;
        
        // Adjust subscores based on length (rough heuristic)
        if (answer != null && !answer.trim().isEmpty()) {
            int words = answer.trim().split("\\s+").length;
            // Longer answers might have better clarity and completeness
            if (words > 100) {
                completenessScore = Math.min(10, completenessScore + 2);
            }
            if (words > 50) {
                clarityScore = Math.min(10, clarityScore + 1);
            }
        }
        
        String improveMsg = "Configure GROQ_API_KEY for full AI scoring";
        if (fallbackScore < 3) {
            improveMsg = "Provide a more detailed answer next time";
        }
        
        Map<String, Object> fallback = new java.util.HashMap<>();
        fallback.put("score", fallbackScore);
        fallback.put("feedback", feedback);
        fallback.put("strengths", List.of("Answer was submitted", "Effort demonstrated"));
        fallback.put("improvements", List.of(improveMsg, "Review core concepts"));
        fallback.put("betterAnswer", "(AI scoring unavailable - reconfigure system)");
        fallback.put("accuracyScore", accuracyScore);
        fallback.put("clarityScore", clarityScore);
        fallback.put("completenessScore", completenessScore);
        fallback.put("rootCause", "AI system temporarily unavailable");
        fallback.put("confidenceInsight", "Unable to assess confidence without AI");
        fallback.put("interruptPrompt", "");
        fallback.put("followUpQuestion", "");
        fallback.put("suggestedLearningPath", List.of("System Design", "Problem Solving", "Communication"));
        fallback.put("structure", Map.of("hasIntro", false, "hasExplanation", false, "hasExample", false, "hasConclusion", false));
        return fallback;
    }

    /**
     * Compute a fallback score based on answer length and quality signals.
     * Used only when AI evaluation fails. This is not the primary scoring mechanism.
     * 
     * Returns 0-10 based on:
     * - Empty/missing: 0
     * - Very short (< 10 words): 1
     * - Short (10-20 words): 2-3
     * - Medium (20-50 words): 4-5
     * - Long (50-150 words): 6-7
     * - Very long (150+ words): 8-9
     */
    private int computeFallbackScore(String answer) {
        if (answer == null || answer.trim().isEmpty()) {
            return 0;
        }
        
        String trimmed = answer.trim();
        int words = trimmed.split("\\s+").length;
        int chars = trimmed.length();
        
        // Very short answers: minimal content
        if (words < 10 || chars < 30) {
            return 1;
        }
        
        // Short answers: basic response
        if (words < 20 || chars < 80) {
            return 2;
        }
        
        // Slightly longer: somewhat substantial
        if (words < 35 || chars < 200) {
            return 3;
        }
        
        // Medium answers: decent response
        if (words < 50 || chars < 350) {
            return 4;
        }
        
        // Medium-good: reasonable detail
        if (words < 80 || chars < 600) {
            return 5;
        }
        
        // Good: substantial content
        if (words < 120 || chars < 1000) {
            return 6;
        }
        
        // Very good: detailed response
        if (words < 180 || chars < 1500) {
            return 7;
        }
        
        // Excellent: comprehensive
        return 8;
    }

    public List<Map<String, Object>> generateQuestions(String category,
                                                        String difficulty,
                                                        int count,
                                                        String targetRole) {
        return generateQuestions(category, difficulty, count, targetRole, List.of());
    }

    @Retryable(value = Exception.class, maxAttempts = 2, backoff = @Backoff(delay = 1100, multiplier = 1.7))
    public List<Map<String, Object>> generateQuestions(String category,
                                                        String difficulty,
                                                        int count,
                                                        String targetRole,
                                                        List<String> exclude) {
        if (!groq.isConfigured()) {
            log.warn("Groq not configured — using local question bank");
            return sliceFallback(category, count);
        }

        String[] techTopics = {"Java / JVM", "Spring & REST", "SQL & indexing", "DSA graphs/trees", "Concurrency",
            "System design", "Microservices", "Caching & Redis", "Messaging", "Security basics"};
        String[] hrTopics = {"Ownership", "Conflict", "Prioritization", "Feedback", "Mistakes & learning", "Stakeholder mgmt"};
        String[] aptTopics = {"Speed-time-distance", "P&L", "Ratios", "Sets", "Series", "Work & time", "Probability"};

        String topicHint = switch (category == null ? "mixed" : category.toLowerCase()) {
            case "technical" -> "Emphasize: " + techTopics[random.nextInt(techTopics.length)]
                + " + " + techTopics[random.nextInt(techTopics.length)] + ".";
            case "hr" -> "Emphasize STAR-ready themes: " + hrTopics[random.nextInt(hrTopics.length)]
                + " + " + hrTopics[random.nextInt(hrTopics.length)] + ".";
            case "aptitude" -> "Emphasize: " + aptTopics[random.nextInt(aptTopics.length)]
                + " + " + aptTopics[random.nextInt(aptTopics.length)] + ".";
            default -> "Mix technical depth + communication + one quantitative reasoning thread.";
        };

        String diffBlock = buildDifficultyBlock(difficulty);

        String excludeBlock = "";
        if (exclude != null && !exclude.isEmpty()) {
            String joined = exclude.stream()
                .filter(s -> s != null && !s.isBlank())
                .map(s -> s.length() > 220 ? s.substring(0, 220) + "…" : s)
                .limit(12)
                .collect(Collectors.joining("\n- "));
            if (!joined.isEmpty()) {
                excludeBlock = "\nBANNED / ALREADY USED (do not repeat or trivially paraphrase):\n- " + joined + "\n";
            }
        }

        String prompt = "You generate a structured interview for role: " + targetRole + ".\n"
            + "Category: " + category + ". Difficulty tier: " + difficulty + ".\n"
            + topicHint + "\n"
            + diffBlock + "\n"
            + excludeBlock + "\n"
            + "SESSION SEED (for diversity): " + java.util.UUID.randomUUID() + "_" + System.nanoTime() + "\n\n"
            + "OUTPUT RULES:\n"
            + "- Return EXACTLY " + count + " objects in a JSON ARRAY only.\n"
            + "- Each object: {\"question\":\"...\",\"tags\":[\"tag1\",\"tag2\"]}\n"
            + "- Questions must be DISTINCT, non-overlapping, and ordered as a natural interview arc "
            + "(warm-up → core depth → stretch).\n"
            + "- For technical: include at least one debugging or design trade-off style question at medium+.\n"
            + "- For hard: include optimization, failure modes, scale, or security angle where sensible.\n"
            + "- Tags: 1–3 short labels (skills/themes).\n"
            + "- Tone: professional interviewer; no fluff; no \"as an AI\".\n\n"
            + "Example shape (do not copy text):\n"
            + "[{\"question\":\"...\",\"tags\":[\"Java\",\"Concurrency\"]}]";

        try {
            String text = callAiJsonOnly(prompt);
            int start = text.indexOf('[');
            int end = text.lastIndexOf(']');
            if (start >= 0 && end > start) {
                text = text.substring(start, end + 1);
            }
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> raw = mapper.readValue(text, List.class);
            List<Map<String, Object>> cleaned = sanitizeQuestions(raw, count);
            if (cleaned.size() >= Math.min(1, count)) {
                return cleaned.size() > count ? cleaned.subList(0, count) : cleaned;
            }
        } catch (Exception e) {
            log.error("generateQuestions failed: {}", e.getMessage());
        }
        return sliceFallback(category, count);
    }

    private String buildDifficultyBlock(String difficulty) {
        String d = difficulty == null ? "medium" : difficulty.toLowerCase();
        return switch (d) {
            case "easy" -> """
                DIFFICULTY = EASY (fresher / beginner):
                - Short, well-scoped prompts; single concept each.
                - Prefer definitions + one tiny example; avoid multi-part system design.
                - Build confidence; still require correctness, not essays.
                """;
            case "hard" -> """
                DIFFICULTY = HARD (senior / startup bar):
                - Industry depth: edge cases, failure modes, SLAs, consistency, perf, cost, security.
                - At least half the set should force trade-off reasoning or design under constraints.
                - Include one question that could plausibly be a follow-up to a prior deep answer.
                """;
            default -> """
                DIFFICULTY = MEDIUM (practical mid-level):
                - Real-world scenarios, debugging, API/data modeling, complexity discussion.
                - Mix \"explain + reason\" with small design or implementation choices.
                """;
        };
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> sanitizeQuestions(List<Map<String, Object>> raw, int count) {
        if (raw == null) {
            return List.of();
        }
        List<Map<String, Object>> out = new ArrayList<>();
        java.util.HashSet<String> seen = new java.util.HashSet<>();
        for (Map<String, Object> row : raw) {
            if (row == null) {
                continue;
            }
            Object qo = row.get("question");
            if (!(qo instanceof String)) {
                continue;
            }
            String q = ((String) qo).trim();
            if (q.length() < 12) {
                continue;
            }
            String norm = q.toLowerCase().replaceAll("\\s+", " ");
            if (seen.contains(norm)) {
                continue;
            }
            seen.add(norm);
            Object tagsObj = row.get("tags");
            List<String> tags = new ArrayList<>();
            if (tagsObj instanceof List<?> list) {
                for (Object t : list) {
                    if (t != null && tags.size() < 4) {
                        tags.add(String.valueOf(t).trim());
                    }
                }
            }
            if (tags.isEmpty()) {
                tags.add("Interview");
            }
            out.add(Map.of("question", q, "tags", tags));
            if (out.size() >= count) {
                break;
            }
        }
        return out;
    }

    private List<Map<String, Object>> sliceFallback(String category, int count) {
        List<Map<String, Object>> pool = getFallbackQuestions(category == null ? "mixed" : category.toLowerCase());
        if (pool.isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> shuffled = new ArrayList<>(pool);
        java.util.Collections.shuffle(shuffled, random);
        List<Map<String, Object>> out = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            out.add(shuffled.get(i % shuffled.size()));
        }
        return out;
    }

    private List<Map<String, Object>> getFallbackQuestions(String category) {
        if ("technical".equals(category)) {
            return List.of(
                Map.of("question", "Compare HashMap vs TreeMap: when would you choose each in production?", "tags", List.of("Java", "Collections")),
                Map.of("question", "How does a relational index speed lookups, and what is a downside?", "tags", List.of("SQL", "Performance")),
                Map.of("question", "Explain idempotency for HTTP POST in a payments API. How do you implement it?", "tags", List.of("API", "Design")),
                Map.of("question", "Walk through detecting a cycle in a directed graph — algorithm and complexity.", "tags", List.of("DSA", "Graphs")),
                Map.of("question", "Design rate limiting for an API gateway at high QPS.", "tags", List.of("System Design")),
                Map.of("question", "What causes deadlocks in Java, and two concrete prevention tactics?", "tags", List.of("Concurrency", "Java"))
            );
        }
        if ("hr".equals(category)) {
            return List.of(
                Map.of("question", "Tell me about a time you missed a deadline. What happened and what changed after?", "tags", List.of("Accountability")),
                Map.of("question", "Describe influencing a decision without authority.", "tags", List.of("Leadership")),
                Map.of("question", "Give an example of receiving hard feedback. How did you respond?", "tags", List.of("Growth")),
                Map.of("question", "How do you prioritize when two senior stakeholders disagree?", "tags", List.of("Communication")),
                Map.of("question", "Tell me about a team conflict you helped resolve.", "tags", List.of("Teamwork"))
            );
        }
        if ("aptitude".equals(category)) {
            return List.of(
                Map.of("question", "A train 180 m long crosses a pole in 9 s. Find its speed in km/h.", "tags", List.of("Speed", "Math")),
                Map.of("question", "If 12 machines produce 960 units in 8 hours, how many units in 5 hours with 9 machines?", "tags", List.of("Work", "Ratio")),
                Map.of("question", "A shop marks up cost by 40% then gives 25% discount on marked price. Profit %?", "tags", List.of("Profit", "Percent")),
                Map.of("question", "In a class of 50, 32 play cricket, 24 play football, 10 play both. How many play neither?", "tags", List.of("Sets")),
                Map.of("question", "Find the next term: 3, 7, 15, 31, 63, ?", "tags", List.of("Series"))
            );
        }
        return List.of(
            Map.of("question", "Explain CAP theorem and when you might relax consistency in practice.", "tags", List.of("Distributed", "System Design")),
            Map.of("question", "How would you debug a sudden latency spike in a microservice?", "tags", List.of("Debugging", "Ops")),
            Map.of("question", "Describe authentication vs authorization with a concrete API example.", "tags", List.of("Security")),
            Map.of("question", "Tell me about a project where requirements changed mid-flight.", "tags", List.of("HR", "Delivery")),
            Map.of("question", "Two pipes fill a tank in 10h and 15h alone. Together, how long to fill?", "tags", List.of("Aptitude", "Work"))
        );
    }

    public String handleChat(String message, String context, String mode, String interviewTopic) {
        if (!groq.isConfigured()) {
            return "AI coach is offline (server missing GROQ_API_KEY).";
        }
        String systemPrompt = "You are iqAI, an advanced interview coach. Use concise markdown when helpful. ";
        if ("interviewer".equals(mode)) {
            systemPrompt += "INTERVIEWER mode on topic: " + interviewTopic + ". Stay on topic. " + context;
        } else {
            systemPrompt += "COACH mode. " + context;
        }
        try {
            return textCallAI(systemPrompt + "\n\nUser:\n" + message);
        } catch (Exception e) {
            log.error("handleChat: {}", e.getMessage());
            return "I'm having trouble reaching the AI service. Please try again shortly.";
        }
    }

    private String textCallAI(String prompt) throws Exception {
        String requestJson = mapper.writeValueAsString(Map.of(
            "model", "llama-3.3-70b-versatile",
            "messages", List.of(
                Map.of("role", "system", "content", "You are iqAI interview coach. Respond in helpful markdown."),
                Map.of("role", "user", "content", prompt)
            ),
            "temperature", 0.65,
            "max_tokens", 1200
        ));
        return postGroqJson(requestJson);
    }
}
