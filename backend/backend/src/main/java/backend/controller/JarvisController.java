package backend.controller;

import backend.service.GeminiService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/jarvis")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class JarvisController {

    private final GeminiService geminiService;

    @PostMapping("/chat")
    public ResponseEntity<Map<String, String>> chat(@RequestBody ChatRequest request) {
        String reply = geminiService.handleChat(
                request.getMessage(),
                request.getContext(),
                request.getMode(),
                request.getInterviewTopic()
        );

        return ResponseEntity.ok(Map.of("reply", reply));
    }

    @Data
    static class ChatRequest {
        private String message;
        private String context;
        private String mode;
        private String interviewTopic;
    }
}
