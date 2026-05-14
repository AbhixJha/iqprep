package backend.controller;

import backend.dto.UpdateProfileRequest;
import backend.entity.User;
import backend.repository.UserRepository;
import backend.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/user")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @GetMapping("/profile")
    public ResponseEntity<User> getProfile(Authentication auth) {
        return ResponseEntity.ok(userService.getByEmail(auth.getName()));
    }

    @PutMapping("/profile")
    public ResponseEntity<User> updateProfile(
            Authentication auth,
            @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(userService.updateProfile(auth.getName(), request));
    }

    @PostMapping("/change-password")
    public ResponseEntity<Map<String, String>> changePassword(
            Authentication auth,
            @RequestBody Map<String, String> body) {

        User user = userRepository.findByEmail(auth.getName())
            .orElseThrow(() -> new RuntimeException("User not found!"));

        if (!passwordEncoder.matches(body.get("oldPassword"), user.getPassword())) {
            return ResponseEntity.badRequest()
                .body(Map.of("message", "Current password is incorrect!"));
        }
        String newPass = body.get("newPassword");
        if (newPass == null || newPass.length() < 6) {
            return ResponseEntity.badRequest()
                .body(Map.of("message", "New password must be at least 6 characters!"));
        }
        user.setPassword(passwordEncoder.encode(newPass));
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Password changed successfully!"));
    }

    @GetMapping("/leaderboard")
    public ResponseEntity<List<Map<String, Object>>> getLeaderboard() {
        List<User> users = userService.getLeaderboard();
        List<Map<String, Object>> leaderboard = new ArrayList<>();
        for (User u : users) {
            Map<String, Object> entry = new HashMap<>();
            entry.put("name", (u.getFirstName() != null ? u.getFirstName() : "") + " " +
                              (u.getLastName()  != null ? u.getLastName()  : ""));
            entry.put("email",        u.getEmail());
            entry.put("averageScore", u.getAverageScore()  != null ? u.getAverageScore()  : 0.0);
            entry.put("totalSessions",u.getTotalSessions() != null ? u.getTotalSessions() : 0);
            entry.put("streakDays",   u.getStreakDays()    != null ? u.getStreakDays()    : 0);
            entry.put("targetRole",   u.getTargetRole()    != null ? u.getTargetRole()    : "Developer");
            leaderboard.add(entry);
        }
        return ResponseEntity.ok(leaderboard);
    }
}