package backend.repository;

import backend.entity.InterviewSession;
import backend.entity.QuestionAnswer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface QuestionAnswerRepository extends JpaRepository<QuestionAnswer, Long> {
    List<QuestionAnswer> findBySession(InterviewSession session);
    List<QuestionAnswer> findBySessionOrderByIdAsc(InterviewSession session);
}
