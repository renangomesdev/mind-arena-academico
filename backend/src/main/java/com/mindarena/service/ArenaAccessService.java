package com.mindarena.service;

import com.mindarena.model.GameStatus;
import com.mindarena.repository.GameSessionRepository;
import com.mindarena.repository.PlayerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.security.Principal;

@Service
public class ArenaAccessService {
    public record Identity(String code, String token, String name) implements Principal {
        @Override public String getName() { return name; }
    }
    private final GameSessionRepository games;
    private final PlayerRepository players;
    private final CredentialRegistry credentials;
    public ArenaAccessService(GameSessionRepository games, PlayerRepository players, CredentialRegistry credentials) {
        this.games = games; this.players = players; this.credentials = credentials;
    }

    @Transactional(readOnly = true)
    public Identity authenticate(String code, String hostToken, String playerId, String playerToken) {
        if (code == null || !code.matches("[A-Z0-9]{6}")) throw new SecurityException("Arena inválida.");
        var game = games.findByCode(code).orElseThrow(() -> new SecurityException("Arena inválida."));
        if (game.isExpired()) throw new SecurityException("Arena encerrada.");
        Identity identity;
        if (hostToken != null) {
            if (!CredentialRegistry.validFormat(hostToken) || !hostToken.equals(game.getHostToken())) throw new SecurityException("Credencial inválida.");
            identity = new Identity(code, hostToken, "host:" + game.getId());
        } else {
            if (!CredentialRegistry.validFormat(playerToken) || playerId == null || !playerId.matches("[0-9]{1,18}")) throw new SecurityException("Credencial inválida.");
            var player = players.findById(Long.valueOf(playerId)).orElseThrow(() -> new SecurityException("Credencial inválida."));
            if (player.isRemoved() || !game.getId().equals(player.getGameSession().getId()) || !playerToken.equals(player.getPlayerToken())) {
                throw new SecurityException("Credencial inválida.");
            }
            identity = new Identity(code, playerToken, "player:" + player.getId());
        }
        credentials.remember(code, identity.token());
        return identity;
    }
}
