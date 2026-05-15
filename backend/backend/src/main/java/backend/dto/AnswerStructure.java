package backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnswerStructure {
    private boolean hasIntro;
    private boolean hasExplanation;
    private boolean hasExample;
    private boolean hasConclusion;
}
