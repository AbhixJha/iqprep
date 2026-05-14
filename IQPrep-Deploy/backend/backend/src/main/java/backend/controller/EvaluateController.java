package backend.controller;

import backend.dto.EvaluateRequest;
import backend.dto.EvaluateResponse;
import backend.service.GeminiService;
import backend.service.RateLimitService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/evaluate")
@RequiredArgsConstructor
public class EvaluateController {

    private final GeminiService geminiService;
    private final RateLimitService rateLimitService;

    @Value("${app.ratelimit.evaluate-per-minute:36}")
    private int evaluatePerMinute;

    @PostMapping
    public ResponseEntity<EvaluateResponse> evaluate(
            @Valid @RequestBody EvaluateRequest request,
            Authentication authentication) {

        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }

        if (!rateLimitService.tryConsume("eval:" + authentication.getName(), evaluatePerMinute)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many evaluations. Try again shortly.");
        }

        Map<String, Object> result = geminiService.evaluateAnswer(
            request.getQuestion(),
            request.getAnswer(),
            request.getCategory(),
            request.getDifficulty(),
            request.getPersonality() != null ? request.getPersonality() : "neutral",
            request.getBehaviorMetrics(),
            request.getPreviousWeaknesses()
        );

        @SuppressWarnings("unchecked")
        List<String> strengths = (List<String>) result.getOrDefault("strengths", List.of());
        @SuppressWarnings("unchecked")
        List<String> improvements = (List<String>) result.getOrDefault("improvements", List.of());

        EvaluateResponse response = EvaluateResponse.builder()
            .score(((Number) result.getOrDefault("score", 5)).intValue())
            .feedback((String) result.getOrDefault("feedback", ""))
            .betterAnswer((String) result.getOrDefault("betterAnswer", ""))
            .accuracyScore(((Number) result.getOrDefault("accuracyScore", 5)).doubleValue())
            .clarityScore(((Number) result.getOrDefault("clarityScore", 5)).doubleValue())
            .completenessScore(((Number) result.getOrDefault("completenessScore", 5)).doubleValue())
            .strengths(String.join(", ", strengths))
            .improvements(String.join(", ", improvements))
            .rootCause((String) result.get("rootCause"))
            .confidenceInsight((String) result.get("confidenceInsight"))
            .interruptPrompt((String) result.get("interruptPrompt"))
            .followUpQuestion((String) result.get("followUpQuestion"))
            .suggestedLearningPath((List<String>) result.get("suggestedLearningPath"))
            .build();

        Object structObj = result.get("structure");
        if (structObj instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Boolean> sMap = (Map<String, Boolean>) structObj;
            backend.dto.AnswerStructure structure = backend.dto.AnswerStructure.builder()
                .hasIntro(Boolean.TRUE.equals(sMap.get("hasIntro")))
                .hasExplanation(Boolean.TRUE.equals(sMap.get("hasExplanation")))
                .hasExample(Boolean.TRUE.equals(sMap.get("hasExample")))
                .hasConclusion(Boolean.TRUE.equals(sMap.get("hasConclusion")))
                .build();
            response.setStructure(structure);
        }

        return ResponseEntity.ok(response);
    }
}
