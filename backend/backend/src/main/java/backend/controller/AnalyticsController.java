package backend.controller;

import backend.entity.InterviewSession;
import backend.entity.User;
import backend.repository.SessionRepository;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/analytics")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class AnalyticsController {

    private final SessionRepository sessionRepository;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getAnalytics(Authentication auth) {
        User user = userRepository.findByEmail(auth.getName())
            .orElseThrow(() -> new RuntimeException("User not found"));

        List<InterviewSession> sessions = sessionRepository
            .findByUserOrderByCreatedAtDesc(user);

        Map<String, Object> analytics = new HashMap<>();

        // Basic stats
        analytics.put("totalSessions", sessions.size());
        analytics.put("totalQuestions", sessions.stream()
            .mapToInt(InterviewSession::getTotalQuestions).sum());

        // Average score
        double avgScore = sessions.stream()
            .mapToDouble(InterviewSession::getScore)
            .average().orElse(0.0);
        analytics.put("averageScore", Math.round(avgScore * 10.0) / 10.0);

        // Best score
        double bestScore = sessions.stream()
            .mapToDouble(InterviewSession::getScore)
            .max().orElse(0.0);
        analytics.put("bestScore", bestScore);

        // Score progression (last 10 sessions)
        List<Map<String, Object>> progression = sessions.stream()
            .limit(10)
            .sorted(Comparator.comparing(InterviewSession::getCreatedAt))
            .map(s -> {
                Map<String, Object> m = new HashMap<>();
                m.put("score", s.getScore());
                m.put("date", s.getCreatedAt().toString());
                m.put("category", s.getCategory());
                return m;
            }).collect(Collectors.toList());
        analytics.put("progression", progression);

        // Category breakdown
        Map<String, Long> categoryCount = sessions.stream()
            .collect(Collectors.groupingBy(
                InterviewSession::getCategory, Collectors.counting()
            ));
        analytics.put("categoryBreakdown", categoryCount);

        // Category average scores
        Map<String, Double> categoryAvg = sessions.stream()
            .collect(Collectors.groupingBy(
                InterviewSession::getCategory,
                Collectors.averagingDouble(InterviewSession::getScore)
            ));
        analytics.put("categoryAverages", categoryAvg);

        // Difficulty breakdown
        Map<String, Long> difficultyCount = sessions.stream()
            .collect(Collectors.groupingBy(
                InterviewSession::getDifficulty, Collectors.counting()
            ));
        analytics.put("difficultyBreakdown", difficultyCount);

        // Recent 7 days activity
        Map<String, Long> weekActivity = new LinkedHashMap<>();
        for (int i = 6; i >= 0; i--) {
            java.time.LocalDate date = java.time.LocalDate.now().minusDays(i);
            long count = sessions.stream()
                .filter(s -> s.getCreatedAt().toLocalDate().equals(date))
                .count();
            weekActivity.put(date.toString(), count);
        }
        analytics.put("weekActivity", weekActivity);

        // Improvement rate
        if (sessions.size() >= 2) {
            List<InterviewSession> sorted = sessions.stream()
                .sorted(Comparator.comparing(InterviewSession::getCreatedAt))
                .collect(Collectors.toList());
            double firstHalfAvg = sorted.subList(0, sorted.size() / 2)
                .stream().mapToDouble(InterviewSession::getScore)
                .average().orElse(0);
            double secondHalfAvg = sorted.subList(sorted.size() / 2, sorted.size())
                .stream().mapToDouble(InterviewSession::getScore)
                .average().orElse(0);
            double improvement = secondHalfAvg - firstHalfAvg;
            analytics.put("improvementRate", Math.round(improvement * 10.0) / 10.0);
        } else {
            analytics.put("improvementRate", 0.0);
        }

        return ResponseEntity.ok(analytics);
    }
}
