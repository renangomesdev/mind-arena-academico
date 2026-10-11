package com.mindarena.service;

import com.mindarena.model.GameStatus;
import com.mindarena.repository.GameSessionRepository;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.List;

@Configuration
@EnableScheduling
public class GameClock {
    private static final Logger log = LoggerFactory.getLogger(GameClock.class);
    private final GameSessionRepository games;
    private final GameService service;

    public GameClock(GameSessionRepository games, GameService service) {
        this.games = games;
        this.service = service;
    }

    @Scheduled(fixedDelay = 250)
    public void tick() {
        for (String code : games.findRunningCodes(List.of(GameStatus.STARTING, GameStatus.QUESTION_ACTIVE))) {
            try {
                service.advanceClock(code);
            } catch (org.springframework.dao.PessimisticLockingFailureException ex) {
                // A command owns the arena row; retry it on the next tick without delaying other arenas.
            } catch (RuntimeException ex) {
                log.error("Não foi possível atualizar o relógio da arena {}", code, ex);
            }
        }
    }

    @Scheduled(fixedDelay = 60000, initialDelay = 60000)
    public void expireGames() { service.expireOldGames(); }
}
