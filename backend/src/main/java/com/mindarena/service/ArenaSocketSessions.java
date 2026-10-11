package com.mindarena.service;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.CloseStatus;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ArenaSocketSessions {
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, String> tokens = new ConcurrentHashMap<>();
    private final Map<String, String> rooms = new ConcurrentHashMap<>();

    public synchronized boolean add(WebSocketSession session) {
        if (sessions.size() >= 500) return false;
        sessions.put(session.getId(), session);
        return true;
    }
    public synchronized void bind(String sessionId, String token, String code) {
        if (!sessions.containsKey(sessionId)) throw new SecurityException("Conexão encerrada.");
        if (tokens.containsKey(sessionId)) throw new SecurityException("Conexão já autenticada.");
        if (tokens.values().stream().filter(token::equals).count() >= 3) throw new SecurityException("Limite de conexões atingido.");
        tokens.put(sessionId, token);
        rooms.put(sessionId, code);
    }
    public synchronized void remove(String id) { sessions.remove(id); tokens.remove(id); rooms.remove(id); }
    public int countForArena(String code) { return (int) rooms.values().stream().filter(code::equals).count(); }
    public boolean underPressure() { return sessions.size() >= 400; }
    public void revoke(String token) {
        if (token == null) return;
        tokens.forEach((id, existing) -> {
            if (token.equals(existing)) {
                WebSocketSession session = sessions.get(id);
                if (session != null) {
                    try { session.close(CloseStatus.POLICY_VIOLATION); } catch (java.io.IOException ignored) { /* Already closed. */ }
                }
                remove(id);
            }
        });
    }
}
