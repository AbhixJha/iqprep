package backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class SessionResponse {
    private Long id;
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
    private LocalDateTime createdAt;
    private List<QAResponse> answers;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    @Builder
    public static class QAResponse {
        private Long id;
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