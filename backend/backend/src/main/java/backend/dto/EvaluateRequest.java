package backend.dto;

import lombok.Data;

@Data
public class EvaluateRequest {
    private String question;
    private String answer;
    private String category;
    private String difficulty;
    private String personality;
    private String behaviorMetrics;
    private java.util.List<String> previousWeaknesses;
}