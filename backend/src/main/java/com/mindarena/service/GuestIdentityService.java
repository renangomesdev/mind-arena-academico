package com.mindarena.service;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;

@Service
public class GuestIdentityService {
    private static final String COOKIE = "arena_device";
    private static final long LIFETIME_SECONDS = 30 * 24 * 60 * 60L;
    private final byte[] key;
    private final boolean trustProxy;

    public GuestIdentityService(@Value("${arena.device-secret:}") String secret,
                                @Value("${arena.trust-proxy:false}") boolean trustProxy) {
        this.trustProxy = trustProxy;
        if (secret != null && !secret.isBlank() && secret.length() < 32) throw new IllegalArgumentException("DEVICE_SECRET deve ter pelo menos 32 caracteres.");
        if (secret == null || secret.isBlank()) { key = new byte[32]; new SecureRandom().nextBytes(key); }
        else {
            try { key = MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8)); }
            catch (Exception ex) { throw new IllegalStateException(ex); }
        }
    }
    public String identify(HttpServletRequest request, HttpServletResponse response) {
        if (request.getCookies() != null) for (Cookie cookie : request.getCookies()) {
            if (COOKIE.equals(cookie.getName())) {
                String id = verify(cookie.getValue());
                if (id != null) return id;
            }
        }
        String id = UUID.randomUUID().toString();
        String payload = id + "." + (System.currentTimeMillis() / 1000 + LIFETIME_SECONDS);
        boolean secure = request.isSecure() || (trustProxy && "https".equalsIgnoreCase(request.getHeader("X-Forwarded-Proto")));
        response.addHeader("Set-Cookie", ResponseCookie.from(COOKIE, payload + "." + sign(payload))
            .httpOnly(true).secure(secure).sameSite("Lax").path("/api/games").maxAge(LIFETIME_SECONDS).build().toString());
        return id;
    }
    private String verify(String value) {
        try {
            if (value == null || value.length() > 180) return null;
            String[] parts = value.split("\\.");
            if (parts.length != 3 || !UUID.fromString(parts[0]).toString().equals(parts[0])) return null;
            long expiry = Long.parseLong(parts[1]);
            long now = System.currentTimeMillis() / 1000;
            if (expiry <= now || expiry > now + LIFETIME_SECONDS) return null;
            String payload = parts[0] + "." + parts[1];
            return MessageDigest.isEqual(sign(payload).getBytes(StandardCharsets.US_ASCII),
                parts[2].getBytes(StandardCharsets.US_ASCII)) ? parts[0] : null;
        } catch (RuntimeException ex) { return null; }
    }
    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) { throw new IllegalStateException(ex); }
    }
}

