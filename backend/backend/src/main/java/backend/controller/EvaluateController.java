package backend.controller;

import backend.dto.EvaluateRequest;
import backend.dto.EvaluateResponse;
import backend.service.GeminiService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/evaluate")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class EvaluateController {

    private final GeminiService geminiService;

    @PostMapping
    public ResponseEntity<EvaluateResponse> evaluate(@RequestBody EvaluateRequest request) {
        Map<String, Object> result = geminiService.evaluateAnswer(
            request.getQuestion(),
            request.getAnswer(),
            request.getCategory(),
            request.getDifficulty(),
            request.getPersonality() != null ? request.getPersonality() : "neutral",
            request.getBehaviorMetrics(),
            request.getPreviousWeaknesses()
        );

        List<String> strengths = (List<String>) result.getOrDefault("strengths", List.of());
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

        // Safe conversion of the structure map
        Object structObj = result.get("structure");
        if (structObj instanceof Map) {
            Map<String, Boolean> sMap = (Map<String, Boolean>) structObj;
            backend.dto.AnswerStructure structure = backend.dto.AnswerStructure.builder()
                .hasIntro(sMap.getOrDefault("hasIntro", false))
                .hasExplanation(sMap.getOrDefault("hasExplanation", false))
                .hasExample(sMap.getOrDefault("hasExample", false))
                .hasConclusion(sMap.getOrDefault("hasConclusion", false))
                .build();
            response.setStructure(structure);
        }

        return ResponseEntity.ok(response);
    }
}