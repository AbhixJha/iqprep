package backend.controller;

import backend.service.ResumeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import java.util.Map;

@RestController
@RequestMapping("/api/resume")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class ResumeController {

    private final ResumeService resumeService;

    @PostMapping("/analyze")
    public ResponseEntity<Map<String, Object>> analyze(
            @RequestBody Map<String, String> body,
            Authentication auth) {
        String resumeText = body.get("resumeText");
        String fileName = body.getOrDefault("fileName", "resume.pdf");
        if (resumeText == null || resumeText.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Resume text is required"));
        }
        return ResponseEntity.ok(resumeService.analyzeResume(auth.getName(), resumeText, fileName));
    }

    @PostMapping("/analyze/file")
    public ResponseEntity<Map<String, Object>> analyzeFile(
            @RequestParam("file") MultipartFile file,
            Authentication auth) {
        if (file.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
        try (PDDocument document = Loader.loadPDF(file.getBytes())) {
            PDFTextStripper stripper = new PDFTextStripper();
            String resumeText = stripper.getText(document);
            if (resumeText == null || resumeText.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Could not extract text from PDF"));
            }
            return ResponseEntity.ok(resumeService.analyzeResume(auth.getName(), resumeText, file.getOriginalFilename()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Error reading PDF file: " + e.getMessage()));
        }
    }

    @GetMapping("/readiness")
    public ResponseEntity<Map<String, Object>> getReadiness(Authentication auth) {
        return ResponseEntity.ok(resumeService.getReadinessScore(auth.getName()));
    }
}