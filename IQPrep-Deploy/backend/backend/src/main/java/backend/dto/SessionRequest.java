package backend.dto;

import lombok.Data;
import java.util.List;

@Data
public class SessionRequest {
    private String category;
    private String difficulty;
    private String personality;
    private Integer totalQuestions;
    private Double score;
    private Double bestScore;
    private Integer timeTaken;
    private List<String> weakTopics;
    private List<String> learningPath;
    private Double readinessScore;
    private List<QARequest> answers;

    @Data
    public static class QARequest {
        private String question;
        private String userAnswer;
        private String aiFeedback;
        private String betterAnswer;
        private Double score;
        private Double accuracyScore;
        private Double clarityScore;
        private Double completenessScore;
        private String tags;
        private Boolean skipped;
    }
}