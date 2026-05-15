package backend.controller;

import backend.entity.User;
import backend.repository.UserRepository;
import backend.security.JwtUtil;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth/oauth")
@CrossOrigin(origins = "*")
public class OAuth2Controller {

    @Autowired private UserRepository userRepository;
    @Autowired private JwtUtil        jwtUtil;

    @Value("${google.client.id:NOT_SET}")       private String googleClientId;
    @Value("${google.client.secret:NOT_SET}")    private String googleClientSecret;
    @Value("${google.redirect.uri:http://127.0.0.1:3002/pages/oauth-callback.html}")
    private String googleRedirectUri;

    @Value("${github.client.id:NOT_SET}")       private String githubClientId;
    @Value("${github.client.secret:NOT_SET}")    private String githubClientSecret;
    @Value("${github.redirect.uri:http://127.0.0.1:3002/pages/oauth-callback.html}")
    private String githubRedirectUri;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper mapper        = new ObjectMapper();

    // ════════════════════════════════════════════════════
    // GOOGLE
    // ════════════════════════════════════════════════════

    /** Frontend calls this first to get the Google consent page URL */
    @GetMapping("/google/url")
    public ResponseEntity<?> googleUrl() {
        if ("NOT_SET".equals(googleClientId))
            return ResponseEntity.status(503).body(Map.of(
                "message", "Google OAuth not configured. Add google.client.id to application.properties"));

        String url = "https://accounts.google.com/o/oauth2/v2/auth"
            + "?client_id="     + googleClientId
            + "&redirect_uri="  + googleRedirectUri
            + "&response_type=code"
            + "&scope=openid%20email%20profile"
            + "&access_type=offline";
        return ResponseEntity.ok(Map.of("url", url));
    }

    /** Frontend sends the ?code= from Google redirect to this endpoint */
    @PostMapping("/google/callback")
    public ResponseEntity<?> googleCallback(@RequestBody Map<String, String> body) {
        String code = body.get("code");
        if (code == null || code.isBlank())
            return ResponseEntity.badRequest().body(Map.of("message", "Code is required"));

        try {
            // 1. Exchange code for access token
            MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
            params.add("code",          code);
            params.add("client_id",     googleClientId);
            params.add("client_secret", googleClientSecret);
            params.add("redirect_uri",  googleRedirectUri);
            params.add("grant_type",    "authorization_code");

            HttpHeaders h = new HttpHeaders();
            h.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            String tokenBody = restTemplate.postForEntity(
                "https://oauth2.googleapis.com/token",
                new HttpEntity<>(params, h), String.class
            ).getBody();

            String accessToken = mapper.readTree(tokenBody).get("access_token").asText();

            // 2. Get user profile
            HttpHeaders ah = new HttpHeaders();
            ah.setBearerAuth(accessToken);
            String profile = restTemplate.exchange(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                HttpMethod.GET, new HttpEntity<>(ah), String.class
            ).getBody();

            JsonNode info   = mapper.readTree(profile);
            String email    = info.get("email").asText();
            String first    = info.has("given_name")  ? info.get("given_name").asText()  : "";
            String last     = info.has("family_name") ? info.get("family_name").asText() : "";

            return loginOrRegister(email, first, last, "GOOGLE");

        } catch (Exception e) {
            System.err.println("[OAuth] Google error: " + e.getMessage());
            return ResponseEntity.status(500)
                .body(Map.of("message", "Google login failed: " + e.getMessage()));
        }
    }

    // ════════════════════════════════════════════════════
    // GITHUB
    // ════════════════════════════════════════════════════

    @GetMapping("/github/url")
    public ResponseEntity<?> githubUrl() {
        if ("NOT_SET".equals(githubClientId))
            return ResponseEntity.status(503).body(Map.of(
                "message", "GitHub OAuth not configured. Add github.client.id to application.properties"));

        String url = "https://github.com/login/oauth/authorize"
            + "?client_id="    + githubClientId
            + "&redirect_uri=" + githubRedirectUri
            + "&scope=user:email"
            + "&state="        + UUID.randomUUID();
        return ResponseEntity.ok(Map.of("url", url));
    }

    @PostMapping("/github/callback")
    public ResponseEntity<?> githubCallback(@RequestBody Map<String, String> body) {
        String code = body.get("code");
        if (code == null || code.isBlank())
            return ResponseEntity.badRequest().body(Map.of("message", "Code is required"));

        try {
            // 1. Exchange code for token
            HttpHeaders h = new HttpHeaders();
            h.setContentType(MediaType.APPLICATION_JSON);
            h.set("Accept", "application/json");

            String tokenBody = restTemplate.postForEntity(
                "https://github.com/login/oauth/access_token",
                new HttpEntity<>(Map.of(
                    "client_id",     githubClientId,
                    "client_secret", githubClientSecret,
                    "code",          code,
                    "redirect_uri",  githubRedirectUri
                ), h), String.class
            ).getBody();

            String accessToken = mapper.readTree(tokenBody).get("access_token").asText();

            // 2. Get user profile
            HttpHeaders ah = new HttpHeaders();
            ah.setBearerAuth(accessToken);
            ah.set("Accept", "application/json");
            HttpEntity<Void> authReq = new HttpEntity<>(ah);

            JsonNode userInfo = mapper.readTree(
                restTemplate.exchange(
                    "https://api.github.com/user", HttpMethod.GET, authReq, String.class
                ).getBody()
            );

            // 3. Get email (may be private — call /user/emails)
            String email = null;
            if (userInfo.has("email") && !userInfo.get("email").isNull())
                email = userInfo.get("email").asText();

            if (email == null) {
                JsonNode emails = mapper.readTree(
                    restTemplate.exchange(
                        "https://api.github.com/user/emails", HttpMethod.GET, authReq, String.class
                    ).getBody()
                );
                for (JsonNode e : emails)
                    if (e.has("primary") && e.get("primary").asBoolean()) {
                        email = e.get("email").asText(); break;
                    }
            }
            if (email == null)
                return ResponseEntity.status(400).body(Map.of(
                    "message", "Could not read email from GitHub. Set your GitHub email to public."));

            String name  = userInfo.has("name") && !userInfo.get("name").isNull()
                ? userInfo.get("name").asText() : userInfo.get("login").asText();
            String[] p   = name.split(" ", 2);
            String first = p[0];
            String last  = p.length > 1 ? p[1] : "";

            return loginOrRegister(email, first, last, "GITHUB");

        } catch (Exception e) {
            System.err.println("[OAuth] GitHub error: " + e.getMessage());
            return ResponseEntity.status(500)
                .body(Map.of("message", "GitHub login failed: " + e.getMessage()));
        }
    }

    // ════════════════════════════════════════════════════
    // SHARED — find existing user or auto-register, return JWT
    // ════════════════════════════════════════════════════
    private ResponseEntity<?> loginOrRegister(
            String email, String firstName, String lastName, String provider) {

        email = email.toLowerCase().trim();
        Optional<User> existing = userRepository.findByEmail(email);

        User user;
        if (existing.isPresent()) {
            user = existing.get();
        } else {
            user = new User();
            user.setEmail(email);
            user.setFirstName(firstName);
            user.setLastName(lastName);
            user.setPassword(UUID.randomUUID().toString()); // random, OAuth users won't use it
            user.setRoles("SDE Fresher");
            user.setTargetRole("SDE Fresher");
            user.setOauthProvider(provider);
            user.setTotalSessions(0);
            user.setAverageScore(0.0);
            userRepository.save(user);
        }

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
            "message",       "Logged in with " + provider
        ));
    }

    private String nvl(String s) { return s != null ? s : ""; }
}