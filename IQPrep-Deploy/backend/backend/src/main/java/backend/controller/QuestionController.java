package backend.controller;

import backend.entity.User;
import backend.repository.UserRepository;
import backend.service.GeminiService;
import backend.service.RateLimitService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/questions")
@RequiredArgsConstructor
public class QuestionController {

    private static final Set<String> CATEGORIES = Set.of("technical", "hr", "aptitude", "mixed");
    private static final Set<String> DIFFICULTIES = Set.of("easy", "medium", "hard");

    private final GeminiService geminiService;
    private final UserRepository userRepository;
    private final RateLimitService rateLimitService;

    @Value("${app.ratelimit.questions-per-minute:24}")
    private int questionsPerMinute;

    @GetMapping("/generate")
    public ResponseEntity<List<Map<String, Object>>> generate(
            @RequestParam String category,
            @RequestParam String difficulty,
            @RequestParam(defaultValue = "5") int count,
            @RequestParam(required = false) List<String> exclude,
            Authentication auth) {

        if (auth == null || auth.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }

        if (!rateLimitService.tryConsume("qgen:" + auth.getName(), questionsPerMinute)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many question requests. Try again shortly.");
        }

        String cat = category == null ? "" : category.trim().toLowerCase(Locale.ROOT);
        String diff = difficulty == null ? "medium" : difficulty.trim().toLowerCase(Locale.ROOT);
        if (!CATEGORIES.contains(cat)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid category");
        }
        if (!DIFFICULTIES.contains(diff)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid difficulty");
        }
        int n = Math.min(50, Math.max(1, count));

        String targetRole = "Software Developer";
        User user = userRepository.findByEmail(auth.getName()).orElse(null);
        if (user != null && user.getTargetRole() != null && !user.getTargetRole().isBlank()) {
            targetRole = user.getTargetRole().trim();
        }

        List<String> cleanExclude = exclude == null ? List.of() : exclude.stream()
            .filter(s -> s != null && !s.isBlank())
            .map(String::trim)
            .limit(15)
            .collect(Collectors.toList());

        List<Map<String, Object>> questions = geminiService.generateQuestions(cat, diff, n, targetRole, cleanExclude);
        return ResponseEntity.ok(questions);
    }
}
