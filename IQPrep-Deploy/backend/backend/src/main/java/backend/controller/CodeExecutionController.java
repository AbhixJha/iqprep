package backend.controller;

import backend.dto.CodeRunRequest;
import backend.dto.CodeRunResponse;
import backend.service.CodeExecutionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/code")
@RequiredArgsConstructor
public class CodeExecutionController {

    private final CodeExecutionService codeExecutionService;

    @PostMapping("/run")
    public ResponseEntity<CodeRunResponse> run(@Valid @RequestBody CodeRunRequest request) {
        try {
            CodeRunResponse res = codeExecutionService.execute(request);
            return ResponseEntity.ok(res);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(
                    CodeRunResponse.builder()
                            .success(false)
                            .message(ex.getMessage())
                            .testPassed(false)
                            .build()
            );
        }
    }
}
