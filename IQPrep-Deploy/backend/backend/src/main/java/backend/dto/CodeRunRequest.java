package backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CodeRunRequest {

    /** java | python | javascript | cpp */
    @NotBlank
    private String language;

    @NotBlank
    private String source;

    /** stdin passed to the program */
    private String stdin;

    /** if set, success requires trimmed stdout to equal trimmed expected */
    private String expectedOutput;
}
