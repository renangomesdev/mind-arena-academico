package com.mindarena.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class OrganizerService {
    private final byte[] passwordDigest;
    private final boolean configured;
    private final Map<String, Long> sessions = new ConcurrentHashMap<>();
    private static final long SESSION_MS = 12 * 60 * 60 * 1000L;

    public OrganizerService(@Value("${arena.organizer-password:}") String password) {
        configured = password != null && !password.isBlank() && password.length() >= 12 && password.length() <= 128;
        passwordDigest = digest(configured ? password : "");
    }
    private static byte[] digest(String value) {
        try { return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)); }
        catch (NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }
    public synchronized Map<String, Object> login(String password) {
        if (!configured) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
            "O responsável pela instalação precisa configurar a senha dos organizadores.");
        if (password == null || !MessageDigest.isEqual(passwordDigest, digest(password))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Senha do organizador incorreta.");
        }
        long now = System.currentTimeMillis();
        sessions.entrySet().removeIf(e -> e.getValue() <= now);
        if (sessions.size() >= 256) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Muitos organizadores conectados. Tente novamente mais tarde.");
        String token = UUID.randomUUID().toString();
        long expiresAt = now + SESSION_MS;
        sessions.put(token, expiresAt);
        return Map.of("organizerToken", token, "expiresAt", expiresAt);
    }
    public void requireAccess(String token) {
        Long expiry = token == null ? null : sessions.get(token);
        if (expiry == null || expiry <= System.currentTimeMillis()) {
            if (token != null) sessions.remove(token);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Entre com a senha do organizador para criar jogos.");
        }
    }
    public void logout(String token) { if (token != null) sessions.remove(token); }
}

