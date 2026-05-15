package backend.service;

import backend.entity.User;
import backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class OtpService {

    private final Map<String, OtpEntry> store = new ConcurrentHashMap<>();

    @Autowired(required = false)   // app still starts without mail config
    private JavaMailSender mailSender;

    @Autowired
    private UserRepository userRepository;

    /** Generate, store and (if email + mail configured) send OTP. Returns the OTP string. */
    public String sendOtp(String contact) {
        String otp = String.format("%06d", new Random().nextInt(999999));
        store.put(contact.toLowerCase().trim(),
                  new OtpEntry(otp, LocalDateTime.now().plusMinutes(10)));

        if (contact.contains("@") && mailSender != null) {
            sendMail(contact, otp);
        } else {
            System.out.println("[DEV] OTP for " + contact + " : " + otp);
        }
        return otp;
    }

    /** Returns true and removes entry on success, false on wrong/expired OTP. */
    public boolean verifyOtp(String contact, String entered) {
        String key   = contact.toLowerCase().trim();
        OtpEntry e   = store.get(key);
        if (e == null || LocalDateTime.now().isAfter(e.expiresAt)) {
            store.remove(key);
            return false;
        }
        if (!e.otp.equals(entered.trim())) return false;
        store.remove(key);   // one-time use
        return true;
    }

    private void sendMail(String to, String otp) {
        try {
            SimpleMailMessage m = new SimpleMailMessage();
            m.setTo(to);
            m.setSubject("IQPrep — Your Login OTP");
            m.setText("Your IQPrep OTP is: " + otp +
                      "\n\nExpires in 10 minutes. Do not share this code.\n\n— IQPrep Team");
            mailSender.send(m);
            System.out.println("[OTP] Email sent to " + to);
        } catch (Exception ex) {
            System.err.println("[OTP] Mail failed: " + ex.getMessage());
        }
    }

    private static class OtpEntry {
        final String otp;
        final LocalDateTime expiresAt;
        OtpEntry(String otp, LocalDateTime expiresAt) {
            this.otp = otp; this.expiresAt = expiresAt;
        }
    }
}
