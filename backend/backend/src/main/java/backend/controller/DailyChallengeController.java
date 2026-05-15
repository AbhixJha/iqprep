package backend.controller;

import backend.service.DailyChallengeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/daily")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class DailyChallengeController {

    private final DailyChallengeService dailyChallengeService;

    @GetMapping("/today")
    public ResponseEntity<Map<String, Object>> getToday(Authentication auth) {
        return ResponseEntity.ok(dailyChallengeService.getTodaysChallenge(auth.getName()));
    }

    @PostMapping("/submit/{id}")
    public ResponseEntity<Map<String, Object>> submit(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        String answer   = (String) body.getOrDefault("answer", "");
        Double score    = body.get("score") != null ? ((Number) body.get("score")).doubleValue() : null;
        String feedback = (String) body.getOrDefault("feedback", null);
        return ResponseEntity.ok(dailyChallengeService.submitChallenge(
            auth.getName(), id, answer, score, feedback));
    }
}