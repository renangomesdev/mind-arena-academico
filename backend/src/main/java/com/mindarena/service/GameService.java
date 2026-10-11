package com.mindarena.service;

import com.mindarena.model.*;
import com.mindarena.repository.*;
import com.mindarena.dto.GameEventDTO;
import com.mindarena.dto.PedagogicalReportDTO;
import com.mindarena.dto.PlayerReviewDTO;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.LinkedHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

@Service
public class GameService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final long COUNTDOWN_MS = 3000;
    @PersistenceContext
    private EntityManager entityManager;
    
    private final GameSessionRepository gameRepo;
    private final QuizRepository quizRepo;
    private final PlayerRepository playerRepo;
    private final PlayerAnswerRepository answerRepo;
    private final SimpMessagingTemplate messagingTemplate;
    private final SecurityAuditService auditService;
    private final ResourceQuotaService quotas;
    private final CredentialRegistry credentials;
    private final ArenaSocketSessions sockets;
    private final ArenaActivityMonitor activity;
    private final ArenaDiagnosticsService diagnostics;
    @org.springframework.beans.factory.annotation.Value("${arena.game-retention-days:30}")
    private int retentionDays;

    public GameService(GameSessionRepository gameRepo, QuizRepository quizRepo, 
                       PlayerRepository playerRepo, PlayerAnswerRepository answerRepo,
                       SimpMessagingTemplate messagingTemplate, SecurityAuditService auditService,
                       ResourceQuotaService quotas, CredentialRegistry credentials, ArenaSocketSessions sockets,
                       ArenaActivityMonitor activity, ArenaDiagnosticsService diagnostics) {
        this.gameRepo = gameRepo;
        this.quizRepo = quizRepo;
        this.playerRepo = playerRepo;
        this.answerRepo = answerRepo;
        this.messagingTemplate = messagingTemplate;
        this.auditService = auditService;
        this.quotas = quotas;
        this.credentials = credentials;
        this.sockets = sockets;
        this.activity = activity;
        this.diagnostics = diagnostics;
    }

    private String generateCode() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 6; i++) {
            sb.append(chars.charAt(RANDOM.nextInt(chars.length())));
        }
        return sb.toString();
    }

    @Transactional
    public GameSession createGame(Long quizId) {
        return createGame(quizId, false);
    }

    @Transactional
    public GameSession createGame(Long quizId, boolean powersEnabled) {
        quotas.beforeGame();
        Quiz quiz = quizRepo.findById(quizId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Quiz não encontrado."));
        if (quiz.getQuestions().isEmpty()) throw new IllegalArgumentException("O quiz não possui perguntas.");
        if (powersEnabled) {
            boolean allHaveHints = quiz.getQuestions().stream()
                .allMatch(q -> q.getHint() != null && !q.getHint().trim().isEmpty());
            if (!allHaveHints) {
                throw new IllegalArgumentException("Todas as perguntas precisam ter dicas para ativar os poderes!");
            }
        }
        GameSession session = new GameSession();
        session.setQuiz(quiz);
        session.setCode(generateCode());
        session.setStatus(GameStatus.WAITING);
        session.setPowersEnabled(powersEnabled);
        session.setHostToken(java.util.UUID.randomUUID().toString());
        session = gameRepo.save(session);
        credentials.remember(session.getCode(), session.getHostToken());
        return session;
    }

    public GameSession getGameByCode(String code) {
        GameSession game = gameRepo.findByCode(normalizeCode(code)).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Partida não encontrada."));
        if (game.isExpired()) throw new ResponseStatusException(HttpStatus.GONE, "Esta arena expirou. Peça um novo código ao organizador.");
        return game;
    }

    private String normalizeCode(String code) {
        if (code == null || !code.trim().matches("(?i)[A-Z0-9]{6}")) throw new IllegalArgumentException("Código da partida inválido.");
        return code.trim().toUpperCase(java.util.Locale.ROOT);
    }

    private GameSession lockGame(String code) {
        GameSession game = gameRepo.findByCodeForUpdate(normalizeCode(code)).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Partida não encontrada."));
        // Token checks may have loaded entities in the request's persistence context before we acquired the lock.
        entityManager.refresh(game);
        if (game.isExpired()) throw new IllegalStateException("Esta arena expirou.");
        return game;
    }

    private Player requireMember(GameSession session, Long playerId) {
        if (playerId == null) throw new IllegalArgumentException("Jogador obrigatório.");
        Player player = playerRepo.findById(playerId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Jogador não encontrado."));
        entityManager.refresh(player);
        if (player.isRemoved()) throw new SecurityException("O organizador removeu este participante.");
        if (player.getGameSession() == null || !session.getId().equals(player.getGameSession().getId())) {
            throw new SecurityException("Jogador não pertence a esta partida.");
        }
        return player;
    }

    private Question requireActiveQuestion(GameSession session) {
        if (session.getStatus() != GameStatus.QUESTION_ACTIVE) throw new IllegalStateException("A pergunta não está ativa.");
        Question question = session.getQuiz().getQuestions().get(session.getCurrentQuestionIndex());
        long deadline = session.getCurrentQuestionStartTime() + question.getTimeLimitSeconds() * 1000L;
        if (System.currentTimeMillis() >= deadline) throw new IllegalStateException("O tempo desta pergunta terminou.");
        return question;
    }

    private void requirePowerAvailable(Player player, Question question) {
        if (answerRepo.existsByPlayerIdAndQuestionId(player.getId(), question.getId())) throw new IllegalStateException("Você já respondeu esta pergunta.");
        if (player.getBlindUntil() != null && player.getBlindUntil() > System.currentTimeMillis()) throw new IllegalStateException("Aguarde o efeito de cegueira terminar.");
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getGameState(String code) {
        return state(getGameByCode(code));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getPublicLobby(String code) {
        GameSession game = getGameByCode(code);
        return Map.of("code", game.getCode(), "status", game.getStatus(), "quiz", com.mindarena.dto.QuizSummary.from(game.getQuiz()),
            "joinLocked", game.isJoinLocked(), "playerCount", playerRepo.countByGameSessionIdAndRemovedFalse(game.getId()));
    }

    @Transactional(readOnly = true)
    public com.mindarena.dto.ArenaDiagnostics getDiagnostics(String code) {
        GameSession game = getGameByCode(code);
        return diagnostics.snapshot(game.getCode(), playerRepo.countByGameSessionIdAndRemovedFalse(game.getId()),
            game.isJoinLocked(), game.getStatus() == GameStatus.WAITING);
    }

    private Map<String, Object> state(GameSession game) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", game.getId());
        result.put("code", game.getCode());
        result.put("quiz", com.mindarena.dto.QuizSummary.from(game.getQuiz()));
        result.put("joinLocked", game.isJoinLocked());
        result.put("status", game.getStatus());
        result.put("powersEnabled", game.isPowersEnabled());
        result.put("currentQuestionIndex", game.getCurrentQuestionIndex());
        result.put("currentQuestionStartTime", game.getCurrentQuestionStartTime());
        result.put("serverTime", System.currentTimeMillis());
        List<Player> players = playerRepo.findByGameSessionIdAndRemovedFalseOrderByScoreDesc(game.getId());
        result.put("players", players);
        result.put("leaderboard", players);
        int index = game.getCurrentQuestionIndex();
        if (index >= 0 && index < game.getQuiz().getQuestions().size()) {
            Question question = game.getQuiz().getQuestions().get(index);
            result.put("currentQuestion", question);
            result.put("answersCount", answerRepo.countByQuestionIdAndPlayerGameSessionIdAndPlayerRemovedFalse(question.getId(), game.getId()));
            if (game.getStatus() == GameStatus.QUESTION_ENDED) result.put("stats", questionStats(game));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getPlayerState(String code, Long playerId) {
        GameSession game = getGameByCode(code);
        Player player = requireMember(game, playerId);
        Map<String, Object> result = state(game);
        result.put("player", player);
        int index = game.getCurrentQuestionIndex();
        if (index >= 0 && index < game.getQuiz().getQuestions().size()) {
            Question question = game.getQuiz().getQuestions().get(index);
            answerRepo.findByPlayerIdAndQuestionId(playerId, question.getId()).ifPresent(answer -> {
                result.put("answer", Map.of("correct", answer.getAnswerOption().isCorrect(), "pointsAwarded", answer.getPointsAwarded(),
                    "streakBonus", answer.getAnswerOption().isCorrect() ? Math.min(Math.max(player.getStreak() - 1, 0) * 200, 1000) : 0,
                    "currentStreak", player.getStreak()));
            });
            if (question.getId().equals(player.getHintQuestionId())) result.put("activeHint", question.getHint());
        }
        return result;
    }

    @Transactional
    public Player joinGame(String code, String nickname) {
        return joinGame(code, nickname, "⚔️");
    }

    @Transactional
    public Player joinGame(String code, String nickname, String avatar) {
        return joinGame(code, nickname, avatar, null);
    }

    @Transactional
    public Player joinGame(String code, String nickname, String avatar, String deviceId) {
        GameSession session = lockGame(code);
        if (deviceId != null) {
            var existing = playerRepo.findByGameSessionIdAndDeviceId(session.getId(), deviceId);
            if (existing.isPresent()) {
                Player player = existing.get();
                if (player.isRemoved()) throw new SecurityException("O organizador removeu este participante.");
                credentials.remember(session.getCode(), player.getPlayerToken());
                return player;
            }
        }
        if (session.isJoinLocked()) throw new IllegalStateException("As entradas estão fechadas. Aguarde o organizador liberar.");
        if (session.getStatus() != GameStatus.WAITING) {
            throw new IllegalStateException("Não é possível entrar nesta partida. Estado atual: " + session.getStatus());
        }
        if (nickname == null || nickname.trim().isEmpty()) {
            throw new IllegalArgumentException("Apelido não pode ser vazio.");
        }
        String cleanNickname = nickname.trim();
        if (cleanNickname.length() > 30) {
            throw new IllegalArgumentException("Apelido deve ter no máximo 30 caracteres.");
        }
        if (playerRepo.countByGameSessionIdAndRemovedFalse(session.getId()) >= 100 || session.getPlayers().size() >= 200) {
            throw new IllegalStateException("A arena atingiu a capacidade máxima de 100 gladiadores.");
        }
        if (playerRepo.existsByGameSessionIdAndNickname(session.getId(), cleanNickname)) {
            throw new IllegalStateException("Apelido já em uso nesta partida.");
        }
        if (avatar != null && avatar.length() > 30) throw new IllegalArgumentException("Avatar inválido.");
        
        Player player = new Player();
        player.setNickname(cleanNickname);
        player.setAvatar(avatar != null && !avatar.isBlank() ? avatar : "⚔️");
        player.setPlayerToken(java.util.UUID.randomUUID().toString());
        player.setDeviceId(deviceId);
        session.addPlayer(player);
        player = playerRepo.save(player);
        credentials.remember(session.getCode(), player.getPlayerToken());
        
        broadcastEvent(code, "PLAYER_JOINED", player);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { activity.recordArrival(session.getCode()); }
        });
        return player;
    }

    @Transactional
    public void startGame(String code) {
        GameSession session = lockGame(code);
        if (session.getStatus() == GameStatus.STARTING) return;
        if (session.getStatus() != GameStatus.WAITING) throw new IllegalStateException("A partida já foi iniciada.");
        if (playerRepo.countByGameSessionIdAndRemovedFalse(session.getId()) == 0) throw new IllegalStateException("Aguarde pelo menos um jogador entrar.");
        session.setStatus(GameStatus.STARTING);
        session.setCurrentQuestionStartTime(System.currentTimeMillis());
        gameRepo.save(session);
        broadcastEvent(code, "GAME_STARTED", Map.of("serverTime", System.currentTimeMillis(), "startTime", session.getCurrentQuestionStartTime()));
    }

    @Transactional
    public void nextQuestion(String code, int expectedIndex) {
        GameSession session = lockGame(code);
        if (session.getStatus() != GameStatus.QUESTION_ENDED || session.getCurrentQuestionIndex() != expectedIndex) {
            throw new IllegalStateException("A partida já avançou ou a pergunta ainda está ativa.");
        }
        openNextQuestion(session);
    }

    private void openNextQuestion(GameSession session) {
        String code = session.getCode();
        session.setCurrentQuestionIndex(session.getCurrentQuestionIndex() + 1);
        
        if (session.getCurrentQuestionIndex() >= session.getQuiz().getQuestions().size()) {
            session.setStatus(GameStatus.FINISHED);
            gameRepo.save(session);
            List<Player> leaderboard = playerRepo.findByGameSessionIdAndRemovedFalseOrderByScoreDesc(session.getId());
            broadcastEvent(code, "FINISHED", leaderboard);
            return;
        }
        
        session.setStatus(GameStatus.QUESTION_ACTIVE);
        session.setCurrentQuestionStartTime(System.currentTimeMillis());
        for (Player player : session.getPlayers()) player.setBlindUntil(null);
        gameRepo.save(session);
        
        Question q = session.getQuiz().getQuestions().get(session.getCurrentQuestionIndex());
        broadcastEvent(code, "QUESTION_STARTED", Map.of("id", q.getId(), "text", q.getText(), "options", q.getOptions(),
            "timeLimitSeconds", q.getTimeLimitSeconds(), "questionIndex", session.getCurrentQuestionIndex(),
            "startTime", session.getCurrentQuestionStartTime(), "serverTime", System.currentTimeMillis(),
            "orderIndex", q.getOrderIndex() == null ? session.getCurrentQuestionIndex() + 1 : q.getOrderIndex(), "hasHint", q.hasHint()));
    }

    @Transactional
    public void advanceClock(String code) {
        gameRepo.findByCodeForClock(normalizeCode(code)).ifPresent(session -> {
            entityManager.refresh(session);
            advanceClock(session);
        });
    }

    private void advanceClock(GameSession session) {
        Long start = session.getCurrentQuestionStartTime();
        if (start == null) return;
        long elapsed = System.currentTimeMillis() - start;
        if (session.getStatus() == GameStatus.STARTING && elapsed >= COUNTDOWN_MS) {
            openNextQuestion(session);
        } else if (session.getStatus() == GameStatus.QUESTION_ACTIVE) {
            Question question = session.getQuiz().getQuestions().get(session.getCurrentQuestionIndex());
            if (elapsed >= question.getTimeLimitSeconds() * 1000L) closeQuestion(session, true);
        }
    }

    @Transactional(readOnly = true)
    public java.util.Map<String, Object> getQuestionStats(String code) {
        GameSession session = getGameByCode(code);
        if (session.getStatus() != GameStatus.QUESTION_ENDED && session.getStatus() != GameStatus.FINISHED) {
            throw new IllegalStateException("Estatísticas disponíveis apenas após o encerramento da pergunta.");
        }
        return questionStats(session);
    }

    private Map<String, Object> questionStats(GameSession session) {
        if (session.getCurrentQuestionIndex() < 0 || session.getCurrentQuestionIndex() >= session.getQuiz().getQuestions().size()) {
            return java.util.Map.of();
        }
        Question q = session.getQuiz().getQuestions().get(session.getCurrentQuestionIndex());
        List<PlayerAnswer> answers = answerRepo.findByQuestionIdAndPlayerGameSessionId(q.getId(), session.getId()).stream()
            .filter(answer -> !answer.getPlayer().isRemoved()).toList();
        
        int totalAnswers = answers.size();
        int totalPlayers = (int) playerRepo.countByGameSessionIdAndRemovedFalse(session.getId());
        
        List<java.util.Map<String, Object>> optionsStats = new java.util.ArrayList<>();
        int correctCount = 0;
        
        for (int i = 0; i < q.getOptions().size(); i++) {
            AnswerOption opt = q.getOptions().get(i);
            long count = answers.stream()
                .filter(a -> a.getAnswerOption() != null && a.getAnswerOption().getId().equals(opt.getId()))
                .count();
            if (opt.isCorrect()) {
                correctCount += (int) count;
            }
            int percentage = totalAnswers > 0 ? (int) Math.round((double) count / totalAnswers * 100) : 0;
            
            optionsStats.add(java.util.Map.of(
                "id", opt.getId(),
                "text", opt.getText(),
                "correct", opt.isCorrect(),
                "count", (int) count,
                "percentage", percentage
            ));
        }
        
        return java.util.Map.of(
            "questionId", q.getId(),
            "questionText", q.getText(),
            "questionIndex", session.getCurrentQuestionIndex(),
            "totalAnswers", totalAnswers,
            "totalPlayers", totalPlayers,
            "correctCount", correctCount,
            "options", optionsStats
        );
    }

    @Transactional
    public void endQuestion(String code, int expectedIndex) {
        GameSession session = lockGame(code);
        if (session.getCurrentQuestionIndex() != expectedIndex) throw new IllegalStateException("Esta pergunta já foi substituída.");
        closeQuestion(session, false);
    }

    private void closeQuestion(GameSession session, boolean timeExpired) {
        if (session.getStatus() != GameStatus.QUESTION_ACTIVE) {
            return;
        }
        if (timeExpired) {
            Long questionId = session.getQuiz().getQuestions().get(session.getCurrentQuestionIndex()).getId();
            var answered = answerRepo.findByQuestionIdAndPlayerGameSessionId(questionId, session.getId()).stream()
                .map(a -> a.getPlayer().getId()).collect(java.util.stream.Collectors.toSet());
            for (Player player : session.getPlayers()) if (!answered.contains(player.getId())) player.resetStreak();
        }
        session.setStatus(GameStatus.QUESTION_ENDED);
        gameRepo.save(session);
        
        List<Player> leaderboard = playerRepo.findByGameSessionIdAndRemovedFalseOrderByScoreDesc(session.getId());
        java.util.Map<String, Object> stats = questionStats(session);
        
        java.util.Map<String, Object> payload = java.util.Map.of(
            "leaderboard", leaderboard,
            "stats", stats
        );
        broadcastEvent(session.getCode(), "QUESTION_ENDED", payload);
    }

    @Transactional
    public java.util.Map<String, Object> submitAnswer(String code, Long playerId, Long questionId, Long optionId, int timeTakenMs) {
        GameSession session = lockGame(code);
        Player player = requireMember(session, playerId);
        Question q = requireActiveQuestion(session);
        if (!q.getId().equals(questionId)) throw new IllegalStateException("Esta pergunta já foi substituída.");
        if (timeTakenMs < 0) throw new IllegalArgumentException("Tempo de resposta inválido.");
        
        if (answerRepo.existsByPlayerIdAndQuestionId(playerId, q.getId())) {
            throw new DuplicateAnswerException(code, playerId);
        }
        if (player.getBlindUntil() != null && player.getBlindUntil() > System.currentTimeMillis()) throw new IllegalStateException("Aguarde o efeito de cegueira terminar.");
        AnswerOption selectedOption = q.getOptions().stream()
            .filter(o -> o.getId().equals(optionId))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Alternativa não pertence à pergunta atual."));
            
        int points = 0;
        int streakBonus = 0;
        int maxTime = q.getTimeLimitSeconds() * 1000;
        long serverElapsed = Math.max(0, System.currentTimeMillis() - session.getCurrentQuestionStartTime());
        int effectiveTimeMs = (int) Math.min(maxTime, Math.max(200, Math.max(timeTakenMs, serverElapsed > 800 ? serverElapsed - 400 : 0)));
        
        if (selectedOption.isCorrect()) {
            player.incrementStreak();
            
            double percentage = 1.0 - ((double) effectiveTimeMs / maxTime);
            if (percentage < 0) percentage = 0;
            int basePoints = 500 + (int)(500 * percentage);
            
            if (player.getStreak() > 1) {
                streakBonus = Math.min((player.getStreak() - 1) * 200, 1000);
            }
            
            points = basePoints + streakBonus;
        } else {
            player.resetStreak();
        }
        
        player.addScore(points);
        playerRepo.save(player);
        
        PlayerAnswer answer = new PlayerAnswer();
        answer.setPlayer(player);
        answer.setQuestion(q);
        answer.setAnswerOption(selectedOption);
        answer.setTimeTakenMs(effectiveTimeMs);
        answer.setPointsAwarded(points);
        answerRepo.save(answer);
        
        broadcastEvent(code, "ANSWER_SUBMITTED", player.getId());
        
        return java.util.Map.of(
            "correct", selectedOption.isCorrect(),
            "pointsAwarded", points,
            "streakBonus", streakBonus,
            "currentStreak", player.getStreak()
        );
    }

    @Transactional
    public void togglePowers(String code, boolean enable) {
        GameSession session = lockGame(code);
        if (session.getStatus() != GameStatus.WAITING) {
            throw new IllegalStateException("Não é possível mudar os poderes após iniciar a partida.");
        }
        
        if (enable) {
            boolean allHaveHints = session.getQuiz().getQuestions().stream()
                .allMatch(q -> q.getHint() != null && !q.getHint().trim().isEmpty());
            if (!allHaveHints) {
                throw new IllegalArgumentException("Todas as perguntas precisam ter dicas para ativar os poderes!");
            }
        }
        
        session.setPowersEnabled(enable);
        gameRepo.save(session);
        broadcastEvent(code, "POWERS_TOGGLED", enable);
    }

    @Transactional
    public void useBlindPower(String code, Long attackerId, Long targetId, Long questionId) {
        GameSession session = lockGame(code);
        Player attacker = requireMember(session, attackerId);
        Player target = requireMember(session, targetId);
        Question question = requireActiveQuestion(session);
        if (!question.getId().equals(questionId)) throw new IllegalStateException("Esta pergunta já foi substituída.");
        if (!session.isPowersEnabled()) throw new IllegalStateException("Os poderes estão desativados.");
        if (attackerId.equals(targetId)) throw new IllegalArgumentException("Você não pode cegar a si mesmo!");
        requirePowerAvailable(attacker, question);
        
        if (attacker.isUsedBlind()) throw new IllegalStateException("O poder de cegueira já foi utilizado.");
        
        attacker.setUsedBlind(true);
        playerRepo.save(attacker);
        target.setBlindUntil(System.currentTimeMillis() + 2000);
        playerRepo.save(target);
        
        broadcastEvent(code, "PLAYER_BLINDED", targetId);
    }

    @Transactional
    public java.util.Map<String, String> useHintPower(String code, Long playerId, Long questionId) {
        GameSession session = lockGame(code);
        Player player = requireMember(session, playerId);
        Question q = requireActiveQuestion(session);
        if (!q.getId().equals(questionId)) throw new IllegalStateException("Esta pergunta já foi substituída.");
        if (!session.isPowersEnabled()) throw new IllegalStateException("Os poderes estão desativados.");
        requirePowerAvailable(player, q);
        
        if (player.isUsedHint()) throw new IllegalStateException("A dica já foi utilizada.");
        
        player.setUsedHint(true);
        player.setHintQuestionId(q.getId());
        playerRepo.save(player);
        
        String hint = (q.getHint() != null && !q.getHint().isBlank()) ? q.getHint() : "Sem dica cadastrada.";
        return java.util.Map.of("hint", hint);
    }

    @Transactional(readOnly = true)
    public PedagogicalReportDTO getPedagogicalReport(String code) {
        GameSession session = getGameByCode(code);
        if (session.getStatus() != GameStatus.FINISHED) {
            throw new IllegalStateException("Relatório pedagógico disponível apenas após o término da partida.");
        }

        Quiz quiz = session.getQuiz();
        List<Question> questions = quiz.getQuestions() != null ? quiz.getQuestions() : List.of();
        int totalPlayers = session.getPlayers() != null ? session.getPlayers().size() : 0;

        List<PlayerAnswer> allAnswers = answerRepo.findByPlayerGameSessionId(session.getId());
        int totalAnswers = allAnswers.size();

        PedagogicalReportDTO report = new PedagogicalReportDTO();
        report.setGameCode(session.getCode());
        report.setQuizTitle(quiz.getTitle());
        report.setQuizDescription(quiz.getDescription());
        report.setGeneratedAt(java.time.LocalDateTime.now());
        report.setTotalPlayers(totalPlayers);
        report.setTotalQuestions(questions.size());
        report.setTotalAnswers(totalAnswers);

        long overallCorrect = allAnswers.stream()
            .filter(a -> a.getAnswerOption() != null && a.getAnswerOption().isCorrect())
            .count();
        double overallAccuracy = totalAnswers > 0
            ? Math.round(((double) overallCorrect / totalAnswers) * 1000.0) / 10.0
            : 0.0;
        report.setOverallAccuracyPercentage(overallAccuracy);

        double totalTimeSeconds = allAnswers.stream()
            .mapToInt(PlayerAnswer::getTimeTakenMs)
            .sum() / 1000.0;
        double avgTime = totalAnswers > 0
            ? Math.round((totalTimeSeconds / totalAnswers) * 10.0) / 10.0
            : 0.0;
        report.setAverageTimeTakenSeconds(avgTime);

        List<PedagogicalReportDTO.QuestionStatDTO> questionStatsList = new ArrayList<>();
        PedagogicalReportDTO.QuestionStatDTO topMastered = null;
        PedagogicalReportDTO.QuestionStatDTO mostChallenging = null;

        for (Question q : questions) {
            List<PlayerAnswer> qAnswers = allAnswers.stream()
                .filter(a -> a.getQuestion() != null && a.getQuestion().getId().equals(q.getId()))
                .toList();

            int qTotal = qAnswers.size();
            long qCorrect = qAnswers.stream()
                .filter(a -> a.getAnswerOption() != null && a.getAnswerOption().isCorrect())
                .count();

            double qAccuracy = qTotal > 0
                ? Math.round(((double) qCorrect / qTotal) * 1000.0) / 10.0
                : 0.0;

            double qAvgTime = qTotal > 0
                ? Math.round((qAnswers.stream().mapToInt(PlayerAnswer::getTimeTakenMs).average().orElse(0.0) / 100.0)) / 10.0
                : 0.0;

            String diagnosis;
            if (qTotal == 0) {
                diagnosis = "SEM RESPOSTAS";
            } else if (qAccuracy >= 80.0) {
                diagnosis = "CONSOLIDADO";
            } else if (qAccuracy >= 60.0) {
                diagnosis = "BOM";
            } else if (qAccuracy >= 40.0) {
                diagnosis = "PONTO DE ATENÇÃO";
            } else {
                diagnosis = "CRÍTICO";
            }

            // Estatísticas por alternativa
            List<PedagogicalReportDTO.OptionStatDTO> optionStats = new ArrayList<>();
            String topMistakeText = null;
            long maxMistakeCount = 0;

            for (AnswerOption opt : q.getOptions()) {
                long optCount = qAnswers.stream()
                    .filter(a -> a.getAnswerOption() != null && a.getAnswerOption().getId().equals(opt.getId()))
                    .count();
                double optPercent = qTotal > 0
                    ? Math.round(((double) optCount / qTotal) * 1000.0) / 10.0
                    : 0.0;

                optionStats.add(new PedagogicalReportDTO.OptionStatDTO(
                    opt.getId(), opt.getText(), opt.isCorrect(), (int) optCount, optPercent
                ));

                if (!opt.isCorrect() && optCount > maxMistakeCount) {
                    maxMistakeCount = optCount;
                    topMistakeText = opt.getText();
                }
            }

            double topMistakePercent = qTotal > 0 && maxMistakeCount > 0
                ? Math.round(((double) maxMistakeCount / qTotal) * 1000.0) / 10.0
                : 0.0;

            PedagogicalReportDTO.QuestionStatDTO qStat = new PedagogicalReportDTO.QuestionStatDTO();
            qStat.setQuestionId(q.getId());
            qStat.setOrderIndex(q.getOrderIndex() != null ? q.getOrderIndex() : 0);
            qStat.setText(q.getText());
            qStat.setTotalAnswers(qTotal);
            qStat.setCorrectAnswers((int) qCorrect);
            qStat.setAccuracyPercentage(qAccuracy);
            qStat.setAverageTimeSeconds(qAvgTime);
            qStat.setPedagogicalDiagnosis(diagnosis);
            qStat.setTopMistakeOptionText(topMistakeText);
            qStat.setTopMistakePercentage(topMistakePercent);
            qStat.setOptions(optionStats);

            questionStatsList.add(qStat);

            if (qTotal > 0) {
                if (topMastered == null || qAccuracy > topMastered.getAccuracyPercentage()) {
                    topMastered = qStat;
                }
                if (mostChallenging == null || qAccuracy < mostChallenging.getAccuracyPercentage()) {
                    mostChallenging = qStat;
                }
            }
        }

        report.setQuestions(questionStatsList);

        if (topMastered != null) {
            report.setMostMasteredQuestion(new PedagogicalReportDTO.HighlightQuestionDTO(
                topMastered.getQuestionId(), topMastered.getOrderIndex(), topMastered.getText(),
                topMastered.getAccuracyPercentage(), topMastered.getTopMistakeOptionText(), topMastered.getTopMistakePercentage()
            ));
        }

        if (mostChallenging != null) {
            report.setMostChallengingQuestion(new PedagogicalReportDTO.HighlightQuestionDTO(
                mostChallenging.getQuestionId(), mostChallenging.getOrderIndex(), mostChallenging.getText(),
                mostChallenging.getAccuracyPercentage(), mostChallenging.getTopMistakeOptionText(), mostChallenging.getTopMistakePercentage()
            ));
        }

        return report;
    }

    @Transactional(readOnly = true)
    public PlayerReviewDTO getPlayerReview(String code, Long playerId) {
        GameSession session = getGameByCode(code);
        if (session.getStatus() != GameStatus.FINISHED) {
            throw new IllegalStateException("Gabarito de estudo disponível apenas após o término da partida.");
        }

        Player player = playerRepo.findById(playerId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Jogador não encontrado."));

        if (!player.getGameSession().getId().equals(session.getId())) {
            throw new SecurityException("Jogador não pertence a esta sessão de jogo.");
        }

        List<Player> leaderboard = playerRepo.findByGameSessionIdAndRemovedFalseOrderByScoreDesc(session.getId());
        int rank = 1;
        for (int i = 0; i < leaderboard.size(); i++) {
            if (leaderboard.get(i).getId().equals(player.getId())) {
                rank = i + 1;
                break;
            }
        }

        List<PlayerAnswer> playerAnswers = answerRepo.findByPlayerId(playerId);
        List<Question> questions = session.getQuiz().getQuestions() != null ? session.getQuiz().getQuestions() : List.of();

        PlayerReviewDTO dto = new PlayerReviewDTO();
        dto.setPlayerId(player.getId());
        dto.setNickname(player.getNickname());
        dto.setAvatar(player.getAvatar());
        dto.setFinalScore(player.getScore());
        dto.setRank(rank);
        dto.setTotalQuestions(questions.size());

        int correctCount = 0;
        List<PlayerReviewDTO.QuestionReviewDTO> qReviews = new ArrayList<>();

        for (Question q : questions) {
            PlayerReviewDTO.QuestionReviewDTO qDto = new PlayerReviewDTO.QuestionReviewDTO();
            qDto.setQuestionId(q.getId());
            qDto.setOrderIndex(q.getOrderIndex() != null ? q.getOrderIndex() : 0);
            qDto.setQuestionText(q.getText());
            qDto.setHint(q.getHint());

            // Buscar opção correta
            AnswerOption correctOpt = q.getOptions().stream()
                .filter(AnswerOption::isCorrect)
                .findFirst()
                .orElse(null);
            if (correctOpt != null) {
                qDto.setCorrectOptionId(correctOpt.getId());
                qDto.setCorrectOptionText(correctOpt.getText());
            }

            // Buscar resposta do aluno
            PlayerAnswer answer = playerAnswers.stream()
                .filter(a -> a.getQuestion() != null && a.getQuestion().getId().equals(q.getId()))
                .findFirst()
                .orElse(null);

            if (answer != null && answer.getAnswerOption() != null) {
                qDto.setSelectedOptionId(answer.getAnswerOption().getId());
                qDto.setSelectedOptionText(answer.getAnswerOption().getText());
                boolean isCorrect = answer.getAnswerOption().isCorrect();
                qDto.setCorrect(isCorrect);
                qDto.setPointsAwarded(answer.getPointsAwarded());
                qDto.setTimeTakenMs(answer.getTimeTakenMs());
                if (isCorrect) correctCount++;
            } else {
                qDto.setSelectedOptionId(null);
                qDto.setSelectedOptionText("Tempo esgotado (não respondeu)");
                qDto.setCorrect(false);
                qDto.setPointsAwarded(0);
                qDto.setTimeTakenMs(0);
            }

            qReviews.add(qDto);
        }

        dto.setCorrectCount(correctCount);
        double accuracy = questions.size() > 0 
            ? Math.round(((double) correctCount / questions.size()) * 1000.0) / 10.0 
            : 0.0;
        dto.setAccuracyPercentage(accuracy);
        dto.setQuestions(qReviews);

        return dto;
    }

    public void verifyHostToken(String code, String hostToken) {
        GameSession session = getGameByCode(code);
        if (session.getHostToken() == null || hostToken == null || !session.getHostToken().equals(hostToken)) {
            auditService.recordEvent(
                "UNAUTHORIZED_HOST", "SECURITY", "/api/games/" + code,
                "HOST_TOKEN_MISMATCH", "HIGH",
                "Tentativa de comando de host não autorizada (token ausente ou divergente).",
                "HostToken: " + (hostToken != null ? "Provided" : "Missing"), true
            );
            throw new SecurityException("Acesso negado: token de controle do host inválido.");
        }
        credentials.remember(session.getCode(), hostToken);
    }

    public void verifyPlayerToken(Long playerId, String playerToken) {
        Player player = playerRepo.findById(playerId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Jogador não encontrado."));
        if (player.isRemoved() || player.getPlayerToken() == null || playerToken == null || !player.getPlayerToken().equals(playerToken)) {
            auditService.recordEvent(
                "PLAYER_" + playerId, "SECURITY", "PLAYER_ACTION",
                "PLAYER_TOKEN_MISMATCH", "HIGH",
                "Tentativa de ação de jogador com token inválido ou divergente (IDOR).",
                "Player: " + playerId, true
            );
            throw new SecurityException("Acesso negado: token do jogador inválido.");
        }
        credentials.remember(player.getGameSession().getCode(), playerToken);
    }

    @Transactional
    public void setJoinLocked(String code, boolean locked) {
        GameSession game = lockGame(code);
        if (game.getStatus() != GameStatus.WAITING) throw new IllegalStateException("A partida já começou.");
        game.setJoinLocked(locked);
        broadcastEvent(code, "LOBBY_LOCKED", locked);
    }

    @Transactional
    public void removePlayer(String code, Long playerId) {
        GameSession game = lockGame(code);
        if (game.getStatus() == GameStatus.FINISHED) throw new IllegalStateException("A partida já terminou.");
        Player player = requireMember(game, playerId);
        String token = player.getPlayerToken();
        player.setRemoved(true);
        player.setPlayerToken(null);
        broadcastEvent(code, "PLAYER_REMOVED", playerId);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { credentials.revoke(token); sockets.revoke(token); }
        });
    }

    @Transactional
    public void expireOldGames() {
        java.time.Instant now = java.time.Instant.now();
        var page = org.springframework.data.domain.PageRequest.of(0, 50);
        for (GameSession game : gameRepo.findByCreatedAtBeforeAndStatusNotIn(now.minusSeconds(43200), List.of(GameStatus.FINISHED), page)) {
            game.setStatus(GameStatus.FINISHED);
            game.setExpired(true);
            broadcastEvent(game.getCode(), "EXPIRED", Map.of());
            revokeArenaConnections(game);
        }
        if (retentionDays <= 0) return;
        for (GameSession game : gameRepo.findByCreatedAtBeforeAndStatusIn(now.minusSeconds(retentionDays * 86400L),
                List.of(GameStatus.FINISHED), org.springframework.data.domain.PageRequest.of(0, 5))) {
            answerRepo.deleteByPlayerGameSessionId(game.getId());
            revokeArenaConnections(game);
            gameRepo.delete(game);
        }
    }

    private void revokeArenaConnections(GameSession game) {
        List<String> tokens = new ArrayList<>();
        if (game.getHostToken() != null) tokens.add(game.getHostToken());
        for (Player player : game.getPlayers()) if (player.getPlayerToken() != null) tokens.add(player.getPlayerToken());
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                for (String token : tokens) { credentials.revoke(token); sockets.revoke(token); }
            }
        });
    }

    private void broadcastEvent(String code, String type, Object payload) {
        GameEventDTO event = new GameEventDTO(type, payload);
        String destination = "/topic/game/" + normalizeCode(code);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() { messagingTemplate.convertAndSend(destination, event); }
            });
        } else {
            messagingTemplate.convertAndSend(destination, event);
        }
    }
}
