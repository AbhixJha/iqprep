package backend.repository;

import backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    Optional<User> findByPhone(String phone);
    boolean existsByEmail(String email);
    boolean existsByPhone(String phone);

    // Fixed — was missing, caused UserService error
    @Query("SELECT u FROM User u WHERE u.totalSessions > 0 ORDER BY u.averageScore DESC")
    List<User> findTopByOrderByAverageScoreDesc();
}