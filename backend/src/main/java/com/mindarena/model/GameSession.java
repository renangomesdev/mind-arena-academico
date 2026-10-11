package com.mindarena.model;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.List;
import java.util.ArrayList;

@Entity
@Table(indexes = @Index(name = "idx_game_status_created", columnList = "status, created_at"))
public class GameSession {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String code;

    @ManyToOne
    @JoinColumn(name = "quiz_id", nullable = false)
    private Quiz quiz;

    @Enumerated(EnumType.STRING)
    private GameStatus status = GameStatus.WAITING;

    private boolean powersEnabled = false;

    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean joinLocked;

    @JsonIgnore
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean expired;

    @JsonIgnore
    @Column(name = "created_at")
    private java.time.Instant createdAt = java.time.Instant.now();

    private Integer currentQuestionIndex = -1;

    @JsonIgnore
    @Column(name = "host_token")
    private String hostToken;

    @Column(name = "current_question_start_time")
    private Long currentQuestionStartTime;

    @OneToMany(mappedBy = "gameSession", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Player> players = new ArrayList<>();

    public GameSession() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public Quiz getQuiz() { return quiz; }
    public void setQuiz(Quiz quiz) { this.quiz = quiz; }
    public GameStatus getStatus() { return status; }
    public void setStatus(GameStatus status) { this.status = status; }
    public boolean isPowersEnabled() { return powersEnabled; }
    public boolean isJoinLocked() { return joinLocked; }
    public boolean isExpired() { return expired; }
    public void setExpired(boolean expired) { this.expired = expired; }
    public void setJoinLocked(boolean joinLocked) { this.joinLocked = joinLocked; }
    public java.time.Instant getCreatedAt() { return createdAt; }
    public void setPowersEnabled(boolean powersEnabled) { this.powersEnabled = powersEnabled; }
    public Integer getCurrentQuestionIndex() { return currentQuestionIndex; }
    public void setCurrentQuestionIndex(Integer currentQuestionIndex) { this.currentQuestionIndex = currentQuestionIndex; }
    public List<Player> getPlayers() { return players; }
    public void setPlayers(List<Player> players) { this.players = players; }
    
    public String getHostToken() { return hostToken; }
    public void setHostToken(String hostToken) { this.hostToken = hostToken; }

    public Long getCurrentQuestionStartTime() { return currentQuestionStartTime; }
    public void setCurrentQuestionStartTime(Long currentQuestionStartTime) { this.currentQuestionStartTime = currentQuestionStartTime; }

    public void addPlayer(Player player) {
        players.add(player);
        player.setGameSession(this);
    }
}
