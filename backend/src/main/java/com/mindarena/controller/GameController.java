package com.mindarena.controller;

import com.mindarena.model.GameSession;
import com.mindarena.model.Player;
import com.mindarena.service.GameService;
import com.mindarena.dto.GameRequests;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/games")
public class GameController {
    private final GameService gameService;
    private final com.mindarena.service.OrganizerService organizers;
    private final com.mindarena.service.GuestIdentityService guests;
    private final com.mindarena.service.ArenaAccessService access;

    public GameController(GameService gameService, com.mindarena.service.OrganizerService organizers,
            com.mindarena.service.GuestIdentityService guests, com.mindarena.service.ArenaAccessService access) {
        this.gameService = gameService; this.organizers = organizers; this.guests = guests; this.access = access;
    }

    @PostMapping("/quiz/{quizId}")
    public ResponseEntity<?> createGame(@PathVariable Long quizId, @RequestBody(required = false) GameRequests.Create body,
            @RequestHeader(value = "X-Organizer-Token", required = false) String token) {
        organizers.requireAccess(token);
        GameSession session = gameService.createGame(quizId, body != null && body.powersEnabled());
        return ResponseEntity.ok(Map.of("id", session.getId(), "code", session.getCode(), "status", session.getStatus(),
            "powersEnabled", session.isPowersEnabled(), "quiz", com.mindarena.dto.QuizSummary.from(session.getQuiz()), "hostToken", session.getHostToken()));
    }

    @GetMapping("/{code}")
    public Map<String, Object> getGame(@PathVariable String code,
            @RequestHeader(value = "X-Host-Token", required = false) String token) {
        if (token == null) return gameService.getPublicLobby(code);
        gameService.verifyHostToken(code, token);
        return gameService.getGameState(code);
    }

    @GetMapping("/{code}/players/{playerId}/state")
    public Map<String, Object> getPlayerState(@PathVariable String code, @PathVariable Long playerId,
            @RequestHeader(value = "X-Player-Token", required = false) String token) {
        gameService.verifyPlayerToken(playerId, token);
        return gameService.getPlayerState(code, playerId);
    }

    @GetMapping("/{code}/diagnostics")
    public com.mindarena.dto.ArenaDiagnostics getDiagnostics(@PathVariable String code,
            @RequestHeader(value = "X-Host-Token", required = false) String token) {
        gameService.verifyHostToken(code, token);
        return gameService.getDiagnostics(code);
    }

    @PostMapping("/{code}/players")
    public ResponseEntity<?> joinGame(@PathVariable String code, @Valid @RequestBody GameRequests.Join body,
            jakarta.servlet.http.HttpServletRequest request, jakarta.servlet.http.HttpServletResponse response) {
        Player player = gameService.joinGame(code, body.nickname(), body.avatar(), guests.identify(request, response));
        return ResponseEntity.ok(Map.of("id", player.getId(), "nickname", player.getNickname(), "avatar", player.getAvatar(),
            "score", player.getScore(), "streak", player.getStreak(), "playerToken", player.getPlayerToken()));
    }

    @PostMapping("/{code}/start")
    public ResponseEntity<?> startGame(@PathVariable String code,
            @RequestHeader(value = "X-Host-Token", required = false) String token) {
        gameService.verifyHostToken(code, token);
        gameService.startGame(code);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{code}/next")
    public ResponseEntity<?> nextQuestion(@PathVariable String code, @Valid @RequestBody GameRequests.Advance body,
            @RequestHeader(value = "X-Host-Token", required = false) String token) {
        gameService.verifyHostToken(code, token);
        gameService.nextQuestion(code, body.questionIndex());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{code}/end-question")
    public ResponseEntity<?> endQuestion(@PathVariable String code, @Valid @RequestBody GameRequests.Advance body,
            @RequestHeader(value = "X-Host-Token", required = false) String token) {
        gameService.verifyHostToken(code, token);
        gameService.endQuestion(code, body.questionIndex());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{code}/question-stats")
    public ResponseEntity<?> getQuestionStats(@PathVariable String code,
            @RequestHeader(value = "X-Host-Token", required = false) String hostToken,
            @RequestHeader(value = "X-Player-Token", required = false) String playerToken,
            @RequestHeader(value = "X-Player-Id", required = false) String playerId) {
        access.authenticate(code.trim().toUpperCase(java.util.Locale.ROOT), hostToken, playerId, playerToken);
        return ResponseEntity.ok(gameService.getQuestionStats(code));
    }

    @GetMapping("/{code}/report")
    public ResponseEntity<?> getPedagogicalReport(@PathVariable String code,
            @RequestHeader(value = "X-Host-Token", required = false) String token) {
        gameService.verifyHostToken(code, token);
        return ResponseEntity.ok(gameService.getPedagogicalReport(code));
    }

    @GetMapping("/{code}/players/{playerId}/review")
    public ResponseEntity<?> getPlayerReview(@PathVariable String code, @PathVariable Long playerId,
            @RequestHeader(value = "X-Player-Token", required = false) String token) {
        gameService.verifyPlayerToken(playerId, token);
        return ResponseEntity.ok(gameService.getPlayerReview(code, playerId));
    }

    @PostMapping("/{code}/answer")
    public ResponseEntity<?> submitAnswer(@PathVariable String code, @Valid @RequestBody GameRequests.Answer body,
            @RequestHeader(value = "X-Player-Token", required = false) String token) {
        gameService.verifyPlayerToken(body.playerId(), token);
        return ResponseEntity.ok(gameService.submitAnswer(code, body.playerId(), body.questionId(), body.optionId(), body.timeTakenMs()));
    }

    @PostMapping("/{code}/toggle-powers")
    public ResponseEntity<?> togglePowers(@PathVariable String code, @Valid @RequestBody GameRequests.Toggle body,
            @RequestHeader(value = "X-Host-Token", required = false) String token) {
        gameService.verifyHostToken(code, token);
        gameService.togglePowers(code, body.enable());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{code}/power/blind")
    public ResponseEntity<?> useBlindPower(@PathVariable String code, @Valid @RequestBody GameRequests.Blind body,
            @RequestHeader(value = "X-Player-Token", required = false) String token) {
        gameService.verifyPlayerToken(body.attackerId(), token);
        gameService.useBlindPower(code, body.attackerId(), body.targetId(), body.questionId());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{code}/power/hint")
    public ResponseEntity<?> useHintPower(@PathVariable String code, @Valid @RequestBody GameRequests.Hint body,
            @RequestHeader(value = "X-Player-Token", required = false) String token) {
        gameService.verifyPlayerToken(body.playerId(), token);
        return ResponseEntity.ok(gameService.useHintPower(code, body.playerId(), body.questionId()));
    }

    @PostMapping("/{code}/lobby-lock")
    public ResponseEntity<?> lockLobby(@PathVariable String code, @Valid @RequestBody GameRequests.Toggle body,
            @RequestHeader(value = "X-Host-Token", required = false) String token) {
        gameService.verifyHostToken(code, token);
        gameService.setJoinLocked(code, body.enable());
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{code}/players/{playerId}")
    public ResponseEntity<?> removePlayer(@PathVariable String code, @PathVariable Long playerId,
            @RequestHeader(value = "X-Host-Token", required = false) String token) {
        gameService.verifyHostToken(code, token);
        gameService.removePlayer(code, playerId);
        return ResponseEntity.ok().build();
    }
}
