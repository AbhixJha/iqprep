package backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class AuthResponse {
    private String token;
    private Long id;
    private String firstName;
    private String lastName;
    private String email;
    private String roles;
    private String targetRole;
    private Integer totalSessions;
    private Double averageScore;
    private Integer streakDays;
    private String message;
    private Boolean success;
}