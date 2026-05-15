package backend.service;

import backend.dto.UpdateProfileRequest;
import backend.entity.User;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    public User getByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found!"));
    }

    public User updateProfile(String email, UpdateProfileRequest request) {
        User user = getByEmail(email);
        if (request.getFirstName() != null) user.setFirstName(request.getFirstName());
        if (request.getLastName()  != null) user.setLastName(request.getLastName());
        if (request.getTargetRole()!= null) user.setTargetRole(request.getTargetRole());
        if (request.getBio()       != null) user.setBio(request.getBio());
        if (request.getRoles()     != null) user.setRoles(request.getRoles());
        return userRepository.save(user);
    }

    public List<User> getLeaderboard() {
        return userRepository.findTopByOrderByAverageScoreDesc();
    }
}