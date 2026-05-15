package backend.controller;

import backend.service.GeminiService;
import backend.entity.User;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/questions")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class QuestionController {

    private final GeminiService geminiService;
    private final UserRepository userRepository;

    @GetMapping("/generate")
    public ResponseEntity<List<Map<String, Object>>> generate(
            @RequestParam String category,
            @RequestParam String difficulty,
            @RequestParam int count,
            Authentication auth) {

        String targetRole = "Software Developer";
        if (auth != null) {
            User user = userRepository.findByEmail(auth.getName()).orElse(null);
            if (user != null && user.getTargetRole() != null) {
                targetRole = user.getTargetRole();
            }
        }

        List<Map<String, Object>> questions = geminiService.generateQuestions(
            category, difficulty, Math.min(count, 50), targetRole
        );

        return ResponseEntity.ok(questions);
    }
}