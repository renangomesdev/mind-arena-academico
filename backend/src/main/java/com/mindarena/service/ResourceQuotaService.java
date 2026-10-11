package com.mindarena.service;
import com.mindarena.model.GameStatus;
import com.mindarena.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@Service
public class ResourceQuotaService {
    private final ResourceQuotaRepository quotas;
    private final GameSessionRepository games;
    private final QuizRepository quizzes;
    private final int maxActiveGames, maxStoredGames, maxQuizzes;
    public ResourceQuotaService(ResourceQuotaRepository quotas, GameSessionRepository games, QuizRepository quizzes,
        @Value("${arena.max-active-games:20}") int maxActiveGames,
        @Value("${arena.max-stored-games:5000}") int maxStoredGames,
        @Value("${arena.max-quizzes:500}") int maxQuizzes) {
        this.quotas = quotas; this.games = games; this.quizzes = quizzes;
        this.maxActiveGames = maxActiveGames; this.maxStoredGames = maxStoredGames; this.maxQuizzes = maxQuizzes;
    }
    @Transactional(propagation = Propagation.MANDATORY)
    public void beforeGame() {
        quotas.lock("games").orElseThrow();
        if (games.countByStatusNotIn(List.of(GameStatus.FINISHED)) >= maxActiveGames ||
            games.count() >= maxStoredGames) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "A instalação atingiu seu limite de salas. Aguarde ou fale com o responsável.");
        }
    }
    @Transactional(propagation = Propagation.MANDATORY)
    public void beforeQuiz() {
        quotas.lock("quizzes").orElseThrow();
        if (quizzes.count() >= maxQuizzes) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
            "A instalação atingiu seu limite de quizzes. Fale com o responsável.");
    }
}

