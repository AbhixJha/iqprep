package backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "interview_sessions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InterviewSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String category;

    @Column(nullable = false)
    private String difficulty;

    @Column
    private String personality;

    @Column(nullable = false)
    private Integer totalQuestions;

    @Column(nullable = false)
    private Double score;

    @Column
    private Double bestScore;

    @Column
    private Integer timeTaken;

    @Column(length = 2000)
    private String weakTopics;

    @Column(length = 2000)
    private String learningPath;

    @Column
    private Double readinessScore;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }
}
