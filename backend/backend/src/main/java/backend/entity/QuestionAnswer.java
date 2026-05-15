package backend.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "question_answers")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuestionAnswer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private InterviewSession session;

    @Column(length = 1000, nullable = false)
    private String question;

    @Column(length = 5000)
    private String userAnswer;

    @Column(length = 3000)
    private String aiFeedback;

    @Column(length = 3000)
    private String betterAnswer;

    @Column
    private Double score;

    @Column
    private Double accuracyScore;

    @Column
    private Double clarityScore;

    @Column
    private Double completenessScore;

    @Column(length = 500)
    private String tags;

    @Column
    private Boolean skipped = false;
}
