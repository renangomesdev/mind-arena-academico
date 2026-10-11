package com.mindarena.service;

import org.springframework.stereotype.Component;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

@Component
public class CredentialRegistry {
    private record Entry(String code, long expiresAt) {}
    private final Map<String, Entry> entries = new ConcurrentHashMap<>();
    private static final Pattern TOKEN = Pattern.compile("[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}");
    private long nextCleanup;
    public static boolean validFormat(String token) { return token != null && TOKEN.matcher(token).matches(); }

    public synchronized void remember(String code, String token) {
        if (token == null || !TOKEN.matcher(token).matches()) return;
        long now = System.currentTimeMillis();
        if (now >= nextCleanup) {
            entries.entrySet().removeIf(e -> e.getValue().expiresAt <= now);
            nextCleanup = now + 60000;
        }
        if (entries.size() < 25000 || entries.containsKey(token)) entries.put(token, new Entry(code, now + 43200000));
    }
    public boolean isKnown(String code, String token) {
        Entry entry = token == null ? null : entries.get(token);
        return entry != null && entry.code.equalsIgnoreCase(code) && entry.expiresAt > System.currentTimeMillis();
    }
    public void revoke(String token) { if (token != null) entries.remove(token); }
}

