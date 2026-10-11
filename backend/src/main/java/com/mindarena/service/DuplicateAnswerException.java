package com.mindarena.service;

public class DuplicateAnswerException extends IllegalStateException {
    private final String gameCode;
    private final Long playerId;

    public DuplicateAnswerException(String gameCode, Long playerId) {
        super("Jogador já respondeu esta pergunta.");
        this.gameCode = gameCode;
        this.playerId = playerId;
    }

    public String getGameCode() { return gameCode; }
    public Long getPlayerId() { return playerId; }
}
