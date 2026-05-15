package backend.controller;

import backend.entity.User;
import backend.repository.UserRepository;
import backend.security.JwtUtil;
import backend.service.OtpService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth/otp")
@CrossOrigin(origins = "*")
public class OtpController {

    @Autowired private OtpService       otpService;
    @Autowired private UserRepository   userRepository;
    @Autowired private JwtUtil          jwtUtil;

    // ── POST /api/auth/otp/send ──────────────────────────
    @PostMapping("/send")
    public ResponseEntity<?> sendOtp(@RequestBody Map<String, String> body) {
        String contact = body.get("contact");
        if (contact == null || contact.isBlank())
            return ResponseEntity.badRequest()
                .body(Map.of("message", "Email or phone is required"));

        contact = contact.trim();
        boolean isEmail = contact.contains("@");

        Optional<User> userOpt = isEmail
            ? userRepository.findByEmail(contact.toLowerCase())
            : userRepository.findByPhone(contact);

        if (userOpt.isEmpty())
            return ResponseEntity.status(404).body(Map.of(
                "message", "No account found with this "
                    + (isEmail ? "email" : "phone") + ". Please register first."));

        String otp = otpService.sendOtp(contact);

        // devOtp returned for easy testing — REMOVE in production
        return ResponseEntity.ok(Map.of(
            "message", "OTP sent successfully",
            "contact", contact,
            "devOtp",  otp
        ));
    }

    // ── POST /api/auth/otp/verify ────────────────────────
    @PostMapping("/verify")
    public ResponseEntity<?> verifyOtp(@RequestBody Map<String, String> body) {
        String contact = body.get("contact");
        String otp     = body.get("otp");

        if (contact == null || otp == null)
            return ResponseEntity.badRequest()
                .body(Map.of("message", "Contact and OTP are required"));

        contact = contact.trim();

        if (!otpService.verifyOtp(contact, otp))
            return ResponseEntity.status(401)
                .body(Map.of("message", "Invalid or expired OTP. Try again."));

        boolean isEmail = contact.contains("@");
        Optional<User> userOpt = isEmail
            ? userRepository.findByEmail(contact.toLowerCase())
            : userRepository.findByPhone(contact);

        if (userOpt.isEmpty())
            return ResponseEntity.status(404).body(Map.of("message", "User not found"));

        User   user  = userOpt.get();
        String token = jwtUtil.generateToken(user.getEmail());

        return ResponseEntity.ok(Map.of(
            "token",         token,
            "id",            user.getId(),
            "firstName",     nvl(user.getFirstName()),
            "lastName",      nvl(user.getLastName()),
            "email",         user.getEmail(),
            "roles",         nvl(user.getRoles()),
            "targetRole",    nvl(user.getTargetRole()),
            "totalSessions", user.getTotalSessions(),
            "averageScore",  user.getAverageScore(),
            "message",       "OTP verified — logged in!"
        ));
    }

    private String nvl(String s) { return s != null ? s : ""; }
}