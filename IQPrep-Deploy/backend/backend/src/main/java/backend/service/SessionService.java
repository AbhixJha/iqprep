package backend.service;

import backend.dto.SessionRequest;
import backend.dto.SessionResponse;
import backend.entity.InterviewSession;
import backend.entity.QuestionAnswer;
import backend.entity.User;
import backend.repository.QuestionAnswerRepository;
import backend.repository.SessionRepository;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SessionService {

    private final SessionRepository sessionRepository;
    private final QuestionAnswerRepository qaRepository;
    private final UserRepository userRepository;

    @Transactional
    public SessionResponse saveSession(String email, SessionRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found!"));

        InterviewSession session = InterviewSession.builder()
                .user(user)
                .category(request.getCategory())
                .difficulty(request.getDifficulty())
                .personality(request.getPersonality())
                .totalQuestions(request.getTotalQuestions())
                .score(request.getScore())
                .bestScore(request.getBestScore())
                .timeTaken(request.getTimeTaken())
                .weakTopics(request.getWeakTopics() != null ?
                    String.join(",", request.getWeakTopics()) : "")
                .learningPath(request.getLearningPath() != null ?
                    String.join(",", request.getLearningPath()) : "")
                .readinessScore(request.getReadinessScore() != null ? request.getReadinessScore() : 0.0)
                .build();

        session = sessionRepository.save(session);

        if (request.getAnswers() != null && !request.getAnswers().isEmpty()) {
            InterviewSession finalSession = session;
            List<QuestionAnswer> qaList = request.getAnswers().stream()
                    .map(qa -> QuestionAnswer.builder()
                            .session(finalSession)
                            .question(qa.getQuestion())
                            .userAnswer(qa.getUserAnswer())
                            .aiFeedback(qa.getAiFeedback())
                            .betterAnswer(qa.getBetterAnswer())
                            .score(qa.getScore())
                            .accuracyScore(qa.getAccuracyScore())
                            .clarityScore(qa.getClarityScore())
                            .completenessScore(qa.getCompletenessScore())
                            .tags(qa.getTags())
                            .skipped(qa.getSkipped() != null && qa.getSkipped())
                            .build())
                    .collect(Collectors.toList());
            qaRepository.saveAll(qaList);
        }

        updateUserStats(user);
        return buildSessionResponse(session);
    }

    private void updateUserStats(User user) {
        List<InterviewSession> allSessions = sessionRepository.findByUserOrderByCreatedAtDesc(user);
        long totalSessions = allSessions.size();
        double avgScore = allSessions.stream()
            .mapToDouble(InterviewSession::getScore)
            .average().orElse(0.0);
        user.setTotalSessions((int) totalSessions);
        user.setAverageScore(Math.round(avgScore * 10.0) / 10.0);
        userRepository.save(user);
    }

    public List<SessionResponse> getUserSessions(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found!"));
        return sessionRepository.findByUserOrderByCreatedAtDesc(user)
                .stream()
                .map(this::buildSessionResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public SessionResponse getSessionById(Long id, String email) {
        InterviewSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Session not found!"));

        if (!session.getUser().getEmail().equals(email)) {
            throw new RuntimeException("Access denied!");
        }

        return buildSessionResponseWithQA(session);
    }

    public Map<String, Object> getUserStats(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found!"));

        List<InterviewSession> sessions = sessionRepository.findByUserOrderByCreatedAtDesc(user);
        Map<String, Object> stats = new HashMap<>();

        stats.put("totalSessions", sessions.size());
        stats.put("totalQuestions", sessions.stream().mapToInt(InterviewSession::getTotalQuestions).sum());
        stats.put("averageScore", user.getAverageScore());
        stats.put("streakDays", user.getStreakDays());

        List<QuestionAnswer> allQAs = sessions.stream()
            .flatMap(s -> qaRepository.findBySessionOrderByIdAsc(s).stream())
            .filter(qa -> !Boolean.TRUE.equals(qa.getSkipped()))
            .collect(Collectors.toList());

        if (!allQAs.isEmpty()) {
            double accuracy = allQAs.stream()
                .mapToDouble(qa -> qa.getAccuracyScore() != null ? qa.getAccuracyScore() : 5.0)
                .average().orElse(5.0);
            double clarity = allQAs.stream()
                .mapToDouble(qa -> qa.getClarityScore() != null ? qa.getClarityScore() : 5.0)
                .average().orElse(5.0);
            double completeness = allQAs.stream()
                .mapToDouble(qa -> qa.getCompletenessScore() != null ? qa.getCompletenessScore() : 5.0)
                .average().orElse(5.0);
            stats.put("accuracyScore", Math.round(accuracy * 10.0) / 10.0);
            stats.put("clarityScore", Math.round(clarity * 10.0) / 10.0);
            stats.put("completenessScore", Math.round(completeness * 10.0) / 10.0);
            
            // Feature 5: Interview Readiness Score (0-100)
            double readiness = ((accuracy + clarity + completeness) / 30.0) * 100.0;
            // Provide a consistency bonus if streak > 1
            if (user.getStreakDays() != null && user.getStreakDays() > 1) {
                readiness += Math.min(5.0, user.getStreakDays()); // Up to 5 bonus points
            }
            stats.put("readinessScore", Math.round(Math.min(100.0, readiness) * 10.0) / 10.0);
        } else {
            stats.put("accuracyScore", 0.0);
            stats.put("clarityScore", 0.0);
            stats.put("completenessScore", 0.0);
        }

        Map<String, Double> catScores = new HashMap<>();
        Map<String, Long> catCounts = new HashMap<>();
        sessions.forEach(s -> {
            catScores.merge(s.getCategory(), s.getScore(), Double::sum);
            catCounts.merge(s.getCategory(), 1L, Long::sum);
        });
        Map<String, Double> catAvg = new HashMap<>();
        catScores.forEach((k, v) -> catAvg.put(k, Math.round((v / catCounts.get(k)) * 10.0) / 10.0));
        stats.put("categoryScores", catAvg);

        List<String> achievements = new ArrayList<>();
        if (sessions.size() >= 1) achievements.add("FIRST_SESSION");
        if (sessions.size() >= 5) achievements.add("FIVE_SESSIONS");
        if (sessions.size() >= 10) achievements.add("TEN_SESSIONS");
        if (sessions.size() >= 25) achievements.add("TWENTY_FIVE_SESSIONS");
        if (user.getStreakDays() != null && user.getStreakDays() >= 3) achievements.add("STREAK_3");
        if (user.getStreakDays() != null && user.getStreakDays() >= 7) achievements.add("STREAK_7");
        boolean hasPerfect = sessions.stream().anyMatch(s -> s.getScore() >= 9.0);
        if (hasPerfect) achievements.add("PERFECT_SCORE");
        boolean hasAllCats = List.of("technical","hr","aptitude","mixed")
            .stream().allMatch(c -> sessions.stream().anyMatch(s -> s.getCategory().equals(c)));
        if (hasAllCats) achievements.add("ALL_ROUNDER");
        stats.put("achievements", achievements);

        return stats;
    }

    private SessionResponse buildSessionResponse(InterviewSession s) {
        return SessionResponse.builder()
                .id(s.getId())
                .category(s.getCategory())
                .difficulty(s.getDifficulty())
                .personality(s.getPersonality())
                .totalQuestions(s.getTotalQuestions())
                .score(s.getScore())
                .bestScore(s.getBestScore())
                .timeTaken(s.getTimeTaken())
                .weakTopics(s.getWeakTopics() != null && !s.getWeakTopics().isEmpty() ?
                    Arrays.asList(s.getWeakTopics().split(",")) : List.of())
                .learningPath(s.getLearningPath() != null && !s.getLearningPath().isEmpty() ?
                    Arrays.asList(s.getLearningPath().split(",")) : List.of())
                .readinessScore(s.getReadinessScore() != null ? s.getReadinessScore() : 0.0)
                .createdAt(s.getCreatedAt())
                .build();
    }

    @Transactional(readOnly = true)
    private SessionResponse buildSessionResponseWithQA(InterviewSession s) {
        List<QuestionAnswer> qaList = qaRepository.findBySessionOrderByIdAsc(s);
        List<SessionResponse.QAResponse> qaResponses = qaList.stream()
                .map(qa -> SessionResponse.QAResponse.builder()
                        .id(qa.getId())
                        .question(qa.getQuestion())
                        .userAnswer(qa.getUserAnswer())
                        .aiFeedback(qa.getAiFeedback())
                        .betterAnswer(qa.getBetterAnswer())
                        .score(qa.getScore())
                        .accuracyScore(qa.getAccuracyScore())
                        .clarityScore(qa.getClarityScore())
                        .completenessScore(qa.getCompletenessScore())
                        .tags(qa.getTags())
                        .skipped(qa.getSkipped())
                        .build())
                .collect(Collectors.toList());

        return SessionResponse.builder()
                .id(s.getId())
                .category(s.getCategory())
                .difficulty(s.getDifficulty())
                .personality(s.getPersonality())
                .totalQuestions(s.getTotalQuestions())
                .score(s.getScore())
                .bestScore(s.getBestScore())
                .timeTaken(s.getTimeTaken())
                .weakTopics(s.getWeakTopics() != null && !s.getWeakTopics().isEmpty() ?
                    Arrays.asList(s.getWeakTopics().split(",")) : List.of())
                .learningPath(s.getLearningPath() != null && !s.getLearningPath().isEmpty() ?
                    Arrays.asList(s.getLearningPath().split(",")) : List.of())
                .readinessScore(s.getReadinessScore() != null ? s.getReadinessScore() : 0.0)
                .createdAt(s.getCreatedAt())
                .answers(qaResponses)
                .build();
    }
}