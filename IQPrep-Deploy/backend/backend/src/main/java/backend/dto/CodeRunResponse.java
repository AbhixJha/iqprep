package backend.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CodeRunResponse {
    private boolean success;
    private String stdout;
    private String stderr;
    private String compileStderr;
    private String compileStdout;
    private Integer compileExitCode;
    private Integer runExitCode;
    private boolean testPassed;
    private String message;
}
