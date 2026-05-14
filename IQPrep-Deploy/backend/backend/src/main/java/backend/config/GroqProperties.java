package backend.config;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Groq OpenAI-compatible API configuration.
 * Reads from groq.api.key first, falls back to gemini.api.key for legacy compat.
 */
@Component
@Getter
public class GroqProperties {

    @Value("${groq.api.key:${gemini.api.key:}}")
    private String apiKey;

    @Value("${groq.api.url:${gemini.api.url:https://api.groq.com/openai/v1/chat/completions}}")
    private String apiUrl;

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }
}

