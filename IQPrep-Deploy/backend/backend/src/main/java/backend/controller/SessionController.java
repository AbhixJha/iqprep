package backend.controller;

import backend.dto.SessionRequest;
import backend.dto.SessionResponse;
import backend.service.SessionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sessions")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class SessionController {

    private final SessionService sessionService;

    @PostMapping
    public ResponseEntity<SessionResponse> saveSession(
            Authentication auth,
            @RequestBody SessionRequest request) {
        return ResponseEntity.ok(sessionService.saveSession(auth.getName(), request));
    }

    @GetMapping
    public ResponseEntity<List<SessionResponse>> getMySessions(Authentication auth) {
        return ResponseEntity.ok(sessionService.getUserSessions(auth.getName()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SessionResponse> getSession(
            @PathVariable Long id,
            Authentication auth) {
        return ResponseEntity.ok(sessionService.getSessionById(id, auth.getName()));
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats(Authentication auth) {
        return ResponseEntity.ok(sessionService.getUserStats(auth.getName()));
    }
}