package backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class EvaluateResponse {
    private Integer score;
    private String feedback;
    private String betterAnswer;
    private Double accuracyScore;
    private Double clarityScore;
    private Double completenessScore;
    private String strengths;
    private String improvements;

    // Advanced Matrix Features
    private String rootCause;
    private String confidenceInsight;
    private AnswerStructure structure;
    private String interruptPrompt;
    private String followUpQuestion;
    private java.util.List<String> suggestedLearningPath;
}
