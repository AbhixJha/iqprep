package backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String email;

    private String password;
    private String firstName;
    private String lastName;

    @Column(unique = true)
    private String phone;

    private String oauthProvider;

    private String roles;
    private String targetRole;
    private String bio;

    private Integer totalSessions;
    private Double  averageScore;
    private Integer streakDays;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        if (this.totalSessions == null) this.totalSessions = 0;
        if (this.averageScore  == null) this.averageScore  = 0.0;
        if (this.streakDays    == null) this.streakDays    = 0;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}