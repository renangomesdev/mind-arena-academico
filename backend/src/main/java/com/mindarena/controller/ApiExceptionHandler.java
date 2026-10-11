package com.mindarena.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import java.util.Map;
import com.mindarena.service.SecurityAuditService;
import com.mindarena.service.DuplicateAnswerException;

@RestControllerAdvice
public class ApiExceptionHandler {
    private final SecurityAuditService audit;

    public ApiExceptionHandler(SecurityAuditService audit) { this.audit = audit; }

    @ExceptionHandler(DuplicateAnswerException.class)
    public ResponseEntity<?> duplicateAnswer(DuplicateAnswerException ex) {
        // The failed gameplay transaction has released its lock and connection before this separate audit write.
        audit.recordEvent("PLAYER_" + ex.getPlayerId(), "POST", "/api/games/" + ex.getGameCode() + "/answer",
            "GAME_DOUBLE_ANSWER_CHEAT", "MEDIUM", "Tentativa de envio de resposta duplicada.", "Player: " + ex.getPlayerId(), true);
        return error(409, ex.getMessage());
    }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> validation(MethodArgumentNotValidException ex) {
        return error(400, "Campos obrigatórios ausentes ou inválidos.");
    }
    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<?> forbidden(SecurityException ex) {
        return error(403, ex.getMessage());
    }

    @ExceptionHandler({IllegalArgumentException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<?> badRequest(Exception ex) {
        return error(400, ex instanceof IllegalArgumentException ? ex.getMessage() : "Corpo da requisição inválido.");
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<?> conflict(IllegalStateException ex) {
        return error(409, ex.getMessage());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<?> duplicate(DataIntegrityViolationException ex) {
        return error(409, "A operação conflita com um registro existente. Atualize a partida e tente novamente.");
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<?> status(ResponseStatusException ex) {
        return error(ex.getStatusCode().value(), ex.getReason());
    }

    private ResponseEntity<?> error(int status, String message) {
        return ResponseEntity.status(status).body(Map.of("status", status, "message", message == null ? "Requisição inválida." : message));
    }
}
