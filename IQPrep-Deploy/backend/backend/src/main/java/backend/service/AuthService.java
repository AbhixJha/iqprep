package backend.service;

import backend.dto.*;
import backend.entity.User;
import backend.repository.UserRepository;
import backend.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthResponse register(RegisterRequest request) {
        String phoneStr = request.getPhone();
        if (phoneStr != null && phoneStr.isBlank()) {
            phoneStr = null;
        }

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already registered!");
        }
        if (phoneStr != null && userRepository.existsByPhone(phoneStr)) {
            throw new RuntimeException("Phone number already registered!");
        }

        User user = User.builder()
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .phone(phoneStr)
                .roles(request.getRoles())
                .targetRole(request.getTargetRole())
                .bio(request.getBio())
                .totalSessions(0)
                .averageScore(0.0)
                .streakDays(0)
                .build();

        userRepository.save(user);
        String token = jwtUtil.generateToken(user.getEmail());

        return AuthResponse.builder()
                .token(token)
                .id(user.getId())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .email(user.getEmail())
                .roles(user.getRoles())
                .targetRole(user.getTargetRole())
                .totalSessions(user.getTotalSessions())
                .averageScore(user.getAverageScore())
                .streakDays(user.getStreakDays())
                .message("Registration successful!")
                .success(true)
                .build();
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Invalid email or password!"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Invalid email or password!");
        }

        String token = jwtUtil.generateToken(user.getEmail());

        return AuthResponse.builder()
                .token(token)
                .id(user.getId())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .email(user.getEmail())
                .roles(user.getRoles())
                .targetRole(user.getTargetRole())
                .totalSessions(user.getTotalSessions())
                .averageScore(user.getAverageScore())
                .streakDays(user.getStreakDays())
                .message("Login successful!")
                .success(true)
                .build();
    }
}