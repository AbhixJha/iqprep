package backend.service;

import backend.dto.CodeRunRequest;
import backend.dto.CodeRunResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class CodeExecutionService {

    private static final String PISTON_EXECUTE = "https://emkc.org/api/v2/piston/execute";

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private final ObjectMapper mapper = new ObjectMapper();

    public CodeRunResponse execute(CodeRunRequest req) {
        try {
            Map<String, Object> body = buildPistonBody(req);
            String json = mapper.writeValueAsString(body);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(PISTON_EXECUTE))
                    .timeout(Duration.ofSeconds(25))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                return CodeRunResponse.builder()
                        .success(false)
                        .message("Execution service returned HTTP " + response.statusCode())
                        .testPassed(false)
                        .build();
            }
            return parsePistonResponse(response.body(), req.getExpectedOutput());
        } catch (Exception e) {
            return CodeRunResponse.builder()
                    .success(false)
                    .message("Could not run code: " + e.getMessage())
                    .testPassed(false)
                    .build();
        }
    }

    private Map<String, Object> buildPistonBody(CodeRunRequest req) {
        String lang = req.getLanguage() == null ? "" : req.getLanguage().trim().toLowerCase();
        if ("c_cpp".equals(lang)) {
            lang = "cpp";
        }

        List<Map<String, String>> files = new ArrayList<>();
        switch (lang) {
            case "java" -> {
                files.add(Map.of("name", "Main.java", "content", req.getSource()));
            }
            case "python" -> {
                files.add(Map.of("name", "main.py", "content", req.getSource()));
            }
            case "javascript" -> {
                files.add(Map.of("name", "main.js", "content", req.getSource()));
            }
            case "cpp" -> {
                files.add(Map.of("name", "main.cpp", "content", req.getSource()));
            }
            default -> throw new IllegalArgumentException("Unsupported language: " + lang);
        }

        Map<String, Object> body = new HashMap<>();
        body.put("language", lang);
        body.put("version", "*");
        body.put("files", files);
        if (req.getStdin() != null && !req.getStdin().isEmpty()) {
            body.put("stdin", req.getStdin());
        }
        return body;
    }

    private CodeRunResponse parsePistonResponse(String rawBody, String expectedOutput) throws Exception {
        JsonNode root = mapper.readTree(rawBody);
        JsonNode compile = root.path("compile");
        JsonNode run = root.path("run");

        String compileOut = pickText(compile, "stdout", "output");
        String compileErr = pickText(compile, "stderr", "error");
        int compileCode = compile != null && !compile.isMissingNode() ? compile.path("code").asInt(0) : 0;

        String runOut = pickText(run, "stdout", "output");
        String runErr = pickText(run, "stderr", "error");
        int runCode = run != null && !run.isMissingNode() ? run.path("code").asInt(-1) : -1;

        boolean compiledOk = compileCode == 0;
        boolean ranOk = runCode == 0;
        boolean success = compiledOk && ranOk;

        boolean testPassed = true;
        if (expectedOutput != null && !expectedOutput.isBlank()) {
            String exp = expectedOutput.trim();
            String act = runOut.trim();
            testPassed = exp.equals(act);
            success = success && testPassed;
        }

        String message;
        if (!compiledOk) {
            message = "Compilation failed";
        } else if (!ranOk) {
            message = "Runtime error (exit " + runCode + ")";
        } else if (expectedOutput != null && !expectedOutput.isBlank() && !testPassed) {
            message = "Output does not match expected result";
        } else {
            message = "OK";
        }

        return CodeRunResponse.builder()
                .success(success)
                .stdout(runOut)
                .stderr(runErr)
                .compileStdout(compileOut)
                .compileStderr(compileErr)
                .compileExitCode(compileCode)
                .runExitCode(runCode)
                .testPassed(testPassed)
                .message(message)
                .build();
    }

    private static String textOrEmpty(JsonNode node, String field) {
        JsonNode v = node.get(field);
        if (v == null || v.isNull()) {
            return "";
        }
        return v.asText("");
    }

    private static String pickText(JsonNode node, String a, String b) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return "";
        }
        String x = textOrEmpty(node, a);
        if (!x.isEmpty()) {
            return x;
        }
        return textOrEmpty(node, b);
    }
}
