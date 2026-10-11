package com.mindarena.model;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(indexes = @Index(name = "idx_player_arena_score", columnList = "game_session_id, removed, score"))
public class Player {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nickname;
    private String avatar = "⚔️";
    private Integer score = 0;
    private Integer streak = 0;
    private boolean usedBlind = false;
    private boolean usedHint = false;

    @JsonIgnore
    private String deviceId;

    @JsonIgnore
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean removed;

    private Long blindUntil;
    @JsonIgnore
    private Long hintQuestionId;

    @JsonIgnore
    @Column(name = "player_token")
    private String playerToken;

    @ManyToOne
    @JoinColumn(name = "game_session_id")
    @JsonIgnore
    private GameSession gameSession;

    public Player() {}

    public Long getId() { return id; }
    public String getDeviceId() { return deviceId; }
    public void setDeviceId(String deviceId) { this.deviceId = deviceId; }
    public boolean isRemoved() { return removed; }
    public void setRemoved(boolean removed) { this.removed = removed; }
    public void setId(Long id) { this.id = id; }
    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }
    public String getAvatar() { return (avatar != null && !avatar.isBlank()) ? avatar : "⚔️"; }
    public void setAvatar(String avatar) { this.avatar = (avatar != null && !avatar.isBlank()) ? avatar : "⚔️"; }
    public Integer getScore() { return score; }
    public void setScore(Integer score) { this.score = score; }
    public Integer getStreak() { return streak; }
    public void setStreak(Integer streak) { this.streak = streak; }
    public void incrementStreak() { this.streak++; }
    public void resetStreak() { this.streak = 0; }
    public boolean isUsedBlind() { return usedBlind; }
    public void setUsedBlind(boolean usedBlind) { this.usedBlind = usedBlind; }
    public boolean isUsedHint() { return usedHint; }
    public void setUsedHint(boolean usedHint) { this.usedHint = usedHint; }
    public Long getBlindUntil() { return blindUntil; }
    public void setBlindUntil(Long blindUntil) { this.blindUntil = blindUntil; }
    public Long getHintQuestionId() { return hintQuestionId; }
    public void setHintQuestionId(Long hintQuestionId) { this.hintQuestionId = hintQuestionId; }
    
    public String getPlayerToken() { return playerToken; }
    public void setPlayerToken(String playerToken) { this.playerToken = playerToken; }

    public GameSession getGameSession() { return gameSession; }
    public void setGameSession(GameSession gameSession) { this.gameSession = gameSession; }
    
    public void addScore(int points) {
        this.score += points;
    }
}
