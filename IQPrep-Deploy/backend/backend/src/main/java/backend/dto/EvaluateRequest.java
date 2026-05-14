package backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class EvaluateRequest {

    @NotBlank(message = "question is required")
    @Size(max = 8000, message = "question too long")
    private String question;

    @NotBlank(message = "answer is required")
    @Size(max = 120_000, message = "answer too long")
    private String answer;

    @Size(max = 64)
    private String category;

    @Size(max = 32)
    private String difficulty;

    @Size(max = 32)
    private String personality;

    @Size(max = 4000)
    private String behaviorMetrics;

    @Size(max = 40, message = "too many weakness entries")
    private List<String> previousWeaknesses;
}
