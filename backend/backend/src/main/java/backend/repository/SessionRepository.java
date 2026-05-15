package backend.repository;

import backend.entity.InterviewSession;
import backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SessionRepository extends JpaRepository<InterviewSession, Long> {
    List<InterviewSession> findByUserOrderByCreatedAtDesc(User user);
    List<InterviewSession> findByUserAndCategoryOrderByCreatedAtDesc(User user, String category);

    @Query("SELECT AVG(s.score) FROM InterviewSession s WHERE s.user = ?1")
    Double findAverageScoreByUser(User user);

    @Query("SELECT MAX(s.score) FROM InterviewSession s WHERE s.user = ?1")
    Double findBestScoreByUser(User user);

    @Query("SELECT COUNT(s) FROM InterviewSession s WHERE s.user = ?1")
    Long countByUser(User user);
}