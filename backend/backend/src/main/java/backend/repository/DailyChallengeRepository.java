package backend.repository;

import backend.entity.DailyChallenge;
import backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface DailyChallengeRepository extends JpaRepository<DailyChallenge, Long> {
    Optional<DailyChallenge> findByUserAndChallengeDate(User user, LocalDate date);
    long countByUserAndCompletedTrue(User user);
}