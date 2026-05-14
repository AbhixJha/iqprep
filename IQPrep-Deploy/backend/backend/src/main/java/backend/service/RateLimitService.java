package backend.service;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory per-key rate limiting (suitable for single-node / demo; use Redis for multi-instance).
 */
@Service
public class RateLimitService {

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    /**
     * @param key        stable id e.g. user email or IP + endpoint
     * @param maxPerMin  max successful consumptions per rolling minute
     * @return true if allowed
     */
    public boolean tryConsume(String key, int maxPerMin) {
        if (maxPerMin <= 0) return true;
        Bucket b = buckets.computeIfAbsent(key, k ->
            Bucket.builder()
                .addLimit(Bandwidth.classic(maxPerMin, Refill.intervally(maxPerMin, Duration.ofMinutes(1))))
                .build());
        return b.tryConsume(1);
    }
}
