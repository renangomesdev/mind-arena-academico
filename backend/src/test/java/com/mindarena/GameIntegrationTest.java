package com.mindarena;

import com.mindarena.model.GameStatus;
import com.mindarena.repository.GameSessionRepository;
import com.mindarena.service.GameService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.BooleanSupplier;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class GameIntegrationTest {
    @LocalServerPort int port;
    @Autowired GameService service;
    @Autowired GameSessionRepository games;
    @Autowired PlatformTransactionManager transactions;
    @Autowired com.mindarena.service.OrganizerService organizers;
    @Autowired org.springframework.messaging.simp.broker.SimpleBrokerMessageHandler broker;
    private final Map<String, String> hostTokens = new ConcurrentHashMap<>();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final JsonMapper json = JsonMapper.builder().build();

    record Reply(int status, Map<String, Object> data) {}
    record Arena(String code, String host, long player, String token, long quiz) {}

    @SuppressWarnings("unchecked")
    private Reply request(String method, String path, Object body, String header, String token) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api" + path)).timeout(Duration.ofSeconds(15));
        if (header == null && method.equals("POST") && (path.equals("/quizzes") || path.startsWith("/games/quiz/"))) {
            builder.header("X-Organizer-Token", (String) organizers.login("testing-organizer-password").get("organizerToken"));
        }
        if (header != null) builder.header(header, token);
        if (body == null) builder.method(method, HttpRequest.BodyPublishers.noBody());
        else builder.header("Content-Type", "application/json").method(method, HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        var response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        Map<String, Object> data = response.body().isBlank() ? Map.of() : json.readValue(response.body(), Map.class);
        return new Reply(response.statusCode(), data);
    }

    private Reply get(String path) throws Exception {
        String[] segments = path.split("/");
        String token = segments.length > 2 ? hostTokens.get(segments[2]) : null;
        boolean privateState = segments.length == 3 || path.endsWith("/question-stats");
        return request("GET", path, null, token != null && privateState ? "X-Host-Token" : null, token);
    }
    private Reply host(Arena arena, String action, Object body) throws Exception {
        return request("POST", "/games/" + arena.code + "/" + action, body, "X-Host-Token", arena.host);
    }
    private Reply player(Arena arena, String action, Object body) throws Exception {
        return request("POST", "/games/" + arena.code + "/" + action, body, "X-Player-Token", arena.token);
    }
    private Reply state(Arena arena) throws Exception {
        return request("GET", "/games/" + arena.code + "/players/" + arena.player + "/state", null, "X-Player-Token", arena.token);
    }
    private long id(Object value) { return ((Number) value).longValue(); }

    private Arena arena(int seconds, boolean powers) throws Exception {
        return arena(seconds, powers, 2);
    }

    private Arena arena(int seconds, boolean powers, int questionCount) throws Exception {
        var question = Map.of("text", "Pergunta de integração", "hint", "Dica de integração", "timeLimitSeconds", seconds,
            "options", List.of(Map.of("text", "Certa", "isCorrect", true), Map.of("text", "Errada", "isCorrect", false)));
        Reply quiz = request("POST", "/quizzes", Map.of("title", "Teste " + UUID.randomUUID(), "description", "d".repeat(500),
            "questions", Collections.nCopies(questionCount, question)), null, null);
        assertEquals(200, quiz.status, quiz.data.toString());
        long quizId = id(quiz.data.get("id"));
        Reply game = request("POST", "/games/quiz/" + quizId, Map.of("powersEnabled", powers), null, null);
        assertEquals(200, game.status, game.data.toString());
        String code = (String) game.data.get("code");
        hostTokens.put(code, (String) game.data.get("hostToken"));
        Reply joined = request("POST", "/games/" + code + "/players", Map.of("nickname", "Aluno", "avatar", "⚔️"), null, null);
        assertEquals(200, joined.status, joined.data.toString());
        return new Arena(code, (String) game.data.get("hostToken"), id(joined.data.get("id")), (String) joined.data.get("playerToken"), quizId);
    }

    private void rewind(Arena arena, long milliseconds) {
        for (int i = 0; i < 5; i++) {
            try {
                new TransactionTemplate(transactions).executeWithoutResult(status -> {
                    var session = games.findByCodeForUpdate(arena.code).orElseThrow();
                    session.setCurrentQuestionStartTime(System.currentTimeMillis() - milliseconds);
                });
                break;
            } catch (Exception e) {
                if (i == 4) throw e;
                try { Thread.sleep(50); } catch (InterruptedException ignored) {}
            }
        }
        service.advanceClock(arena.code);
    }
    private void begin(Arena arena) throws Exception {
        assertEquals(200, host(arena, "start", Map.of()).status);
        rewind(arena, 3100);
    }
    @SuppressWarnings("unchecked")
    private Map<String, Object> question(Arena arena) throws Exception {
        var game = get("/games/" + arena.code).data;
        return (Map<String, Object>) game.get("currentQuestion");
    }
    @SuppressWarnings("unchecked")
    private Map<String, Object> answer(Arena arena, boolean correct) throws Exception {
        var q = question(arena);
        var options = (List<Map<String, Object>>) q.get("options");
        var option = options.stream().filter(o -> o.get("text").equals(correct ? "Certa" : "Errada")).findFirst().orElseThrow();
        return Map.of("playerId", arena.player, "questionId", q.get("id"), "optionId", option.get("id"), "timeTakenMs", 200);
    }

    @Test
    void restPreflightAcceptsConfiguredOriginAndRejectsUnknownOrigin() throws Exception {
        for (String origin : List.of("http://localhost:5173", "https://untrusted.example.org")) {
            var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/quizzes"))
                .header("Origin", origin).header("Access-Control-Request-Method", "GET")
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody()).build();
            var reply = http.send(request, HttpResponse.BodyHandlers.discarding());
            if (origin.startsWith("http://localhost")) {
                assertEquals(200, reply.statusCode());
                assertEquals(origin, reply.headers().firstValue("Access-Control-Allow-Origin").orElseThrow());
                assertEquals("true", reply.headers().firstValue("Access-Control-Allow-Credentials").orElseThrow());
            } else {
                assertEquals(403, reply.statusCode());
                assertTrue(reply.headers().firstValue("Access-Control-Allow-Origin").isEmpty());
            }
        }
    }

    @Test
    void websocketHandshakeChecksTheConfiguredOrigin() throws Exception {
        URI endpoint = URI.create("ws://localhost:" + port + "/ws");
        var connected = http.newWebSocketBuilder().header("Origin", "http://localhost:5173")
            .buildAsync(endpoint, new WebSocket.Listener() {}).get(5, TimeUnit.SECONDS);
        connected.sendClose(WebSocket.NORMAL_CLOSURE, "test").get(5, TimeUnit.SECONDS);
        var rejected = http.newWebSocketBuilder().header("Origin", "https://untrusted.example.org")
            .buildAsync(endpoint, new WebSocket.Listener() {});
        var exception = assertThrows(ExecutionException.class, () -> rejected.get(5, TimeUnit.SECONDS));
        assertInstanceOf(WebSocketHandshakeException.class, exception.getCause());
        assertEquals(403, ((WebSocketHandshakeException) exception.getCause()).getResponse().statusCode());
    }

    @Test
    void fullGameKeepsScoringPowersRankingAndPrivateReports() throws Exception {
        Arena a = arena(30, true);
        assertEquals(403, request("POST", "/games/" + a.code + "/start", Map.of(), null, null).status);
        begin(a);
        var q = question(a);
        assertEquals(200, player(a, "power/hint", Map.of("playerId", a.player, "questionId", q.get("id"))).status);
        assertEquals("Dica de integração", state(a).data.get("activeHint"));
        assertEquals(409, player(a, "power/hint", Map.of("playerId", a.player, "questionId", q.get("id"))).status);
        Reply correct = player(a, "answer", answer(a, true));
        assertEquals(200, correct.status, correct.data.toString());
        assertEquals(true, correct.data.get("correct"));
        assertTrue(id(correct.data.get("pointsAwarded")) >= 500 && id(correct.data.get("pointsAwarded")) <= 1000);
        assertTrue(state(a).data.containsKey("answer"));
        assertEquals(200, host(a, "end-question", Map.of("questionIndex", 0)).status);
        assertEquals(200, get("/games/" + a.code + "/question-stats").status);
        assertEquals(200, host(a, "next", Map.of("questionIndex", 0)).status);
        Reply second = player(a, "answer", answer(a, true));
        assertEquals(200, second.status, second.data.toString());
        assertEquals(200, id(second.data.get("streakBonus")));
        assertEquals(200, host(a, "end-question", Map.of("questionIndex", 1)).status);
        assertEquals(200, host(a, "next", Map.of("questionIndex", 1)).status);
        assertEquals("FINISHED", state(a).data.get("status"));
        assertEquals(403, get("/games/" + a.code + "/report").status);
        assertEquals(200, request("GET", "/games/" + a.code + "/report", null, "X-Host-Token", a.host).status);
        assertEquals(403, get("/games/" + a.code + "/players/" + a.player + "/review").status);
        Reply review = request("GET", "/games/" + a.code + "/players/" + a.player + "/review", null, "X-Player-Token", a.token);
        assertEquals(200, review.status);
        assertEquals(2, id(review.data.get("correctCount")));
    }

    @Test
    void blocksCrossArenaAnswersHintsAndTargets() throws Exception {
        Arena a = arena(30, true), b = arena(30, true);
        begin(a); begin(b);
        var payload = new HashMap<>(answer(b, true));
        payload.put("playerId", a.player);
        assertEquals(403, request("POST", "/games/" + b.code + "/answer", payload, "X-Player-Token", a.token).status);
        var qb = question(b);
        assertEquals(403, request("POST", "/games/" + b.code + "/power/hint", Map.of("playerId", a.player, "questionId", qb.get("id")), "X-Player-Token", a.token).status);
        assertEquals(403, player(a, "power/blind", Map.of("attackerId", a.player, "targetId", b.player, "questionId", question(a).get("id"))).status);
        assertEquals(403, request("GET", "/games/" + b.code + "/players/" + a.player + "/state", null, "X-Player-Token", a.token).status);
    }

    @Test
    void hidesAnswersAndHintsUntilAppropriate() throws Exception {
        Arena a = arena(30, true);
        begin(a);
        Reply snapshot = get("/games/" + a.code);
        String serialized = json.writeValueAsString(snapshot.data);
        assertFalse(serialized.contains("hostToken"));
        assertFalse(serialized.contains("playerToken"));
        assertFalse(serialized.contains("isCorrect"));
        assertFalse(serialized.contains("\"correct\""));
        assertFalse(serialized.contains("Dica de integração"));
        assertFalse(snapshot.data.containsKey("stats"));
        assertEquals(409, get("/games/" + a.code + "/question-stats").status);
    }

    @Test
    void clockOpensAndClosesQuestionsWithoutHostRequests() throws Exception {
        Arena a = arena(1, false);
        assertEquals(200, host(a, "start", Map.of()).status);
        await(() -> games.findByCode(a.code).orElseThrow().getStatus() == GameStatus.QUESTION_ACTIVE, 5000);
        await(() -> games.findByCode(a.code).orElseThrow().getStatus() == GameStatus.QUESTION_ENDED, 2500);
        assertEquals("QUESTION_ENDED", state(a).data.get("status"));
    }

    @Test
    void rejectsExpiredAndStaleAnswersAndHostCommands() throws Exception {
        Arena a = arena(30, false);
        begin(a);
        var staleAnswer = answer(a, true);
        assertEquals(409, host(a, "next", Map.of("questionIndex", 0)).status);
        assertEquals(409, host(a, "start", Map.of()).status);
        rewind(a, 31000);
        assertEquals(409, player(a, "answer", staleAnswer).status);
        assertEquals(200, host(a, "next", Map.of("questionIndex", 0)).status);
        assertEquals(409, host(a, "next", Map.of("questionIndex", 0)).status);
        assertEquals(409, host(a, "end-question", Map.of("questionIndex", 0)).status);
        assertEquals(409, player(a, "answer", staleAnswer).status);
    }

    @Test
    void acceptsOnlyOneOfTwoConcurrentAnswers() throws Exception {
        Arena a = arena(30, false);
        begin(a);
        var payload = answer(a, true);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var tasks = List.<Callable<Reply>>of(() -> player(a, "answer", payload), () -> player(a, "answer", payload));
            var results = executor.invokeAll(tasks);
            var codes = new ArrayList<Integer>();
            for (var result : results) codes.add(result.get().status);
            Collections.sort(codes);
            assertEquals(List.of(200, 409), codes);
        } finally { executor.shutdownNow(); }
        assertEquals(1, id(get("/games/" + a.code).data.get("answersCount")));
    }

    @Test
    void validatesBodiesAndRestoresWrongAnswer() throws Exception {
        Arena a = arena(30, true);
        assertEquals(409, player(a, "power/hint", Map.of("playerId", a.player, "questionId", 1)).status);
        begin(a);
        assertEquals(400, player(a, "answer", Map.of("playerId", a.player)).status);
        var negative = new HashMap<>(answer(a, false));
        negative.put("timeTakenMs", -1);
        assertEquals(400, player(a, "answer", negative).status);
        assertEquals(200, player(a, "answer", answer(a, false)).status);
        @SuppressWarnings("unchecked") var restored = (Map<String, Object>) state(a).data.get("answer");
        assertEquals(false, restored.get("correct"));
        assertEquals(0, id(restored.get("pointsAwarded")));
    }

    @Test
    void blindnessIsEnforcedOnTheServerAndSurvivesStateRecovery() throws Exception {
        Arena a = arena(30, true);
        Reply target = request("POST", "/games/" + a.code + "/players", Map.of("nickname", "Oponente"), null, null);
        Arena b = new Arena(a.code, a.host, id(target.data.get("id")), (String) target.data.get("playerToken"), a.quiz);
        begin(a);
        var blind = Map.of("attackerId", a.player, "targetId", b.player, "questionId", question(a).get("id"));
        assertEquals(200, player(a, "power/blind", blind).status);
        assertEquals(409, player(a, "power/blind", blind).status);
        @SuppressWarnings("unchecked") var restored = (Map<String, Object>) state(b).data.get("player");
        long until = id(restored.get("blindUntil"));
        assertTrue(until > System.currentTimeMillis());
        assertEquals(409, player(b, "answer", answer(b, true)).status);
        Thread.sleep(Math.max(0, until - System.currentTimeMillis()) + 50);
        assertEquals(200, player(b, "answer", answer(b, true)).status);
        assertEquals(409, player(b, "power/hint", Map.of("playerId", b.player, "questionId", question(b).get("id"))).status);
    }

    @Test
    void oneHundredPlayersCanJoinAndAnswerConcurrentlyOnTheSameIp() throws Exception {
        Arena a = arena(60, false);
        List<Arena> participants = new ArrayList<>();
        participants.add(a);
        var executor = Executors.newFixedThreadPool(12);
        try {
            List<Callable<Reply>> joins = new ArrayList<>();
            for (int i = 1; i < 100; i++) {
                final int index = i;
                joins.add(() -> request("POST", "/games/" + a.code + "/players", Map.of("nickname", "Aluno" + index), null, null));
            }
            for (var future : executor.invokeAll(joins)) {
                Reply joined = future.get();
                assertEquals(200, joined.status, joined.data.toString());
                participants.add(new Arena(a.code, a.host, id(joined.data.get("id")), (String) joined.data.get("playerToken"), a.quiz));
            }
            assertEquals(409, request("POST", "/games/" + a.code + "/players", Map.of("nickname", "Excedente"), null, null).status);
            begin(a);
            var template = answer(a, true);
            List<Callable<Reply>> answers = new ArrayList<>();
            for (Arena participant : participants) {
                var payload = new HashMap<>(template);
                payload.put("playerId", participant.player);
                answers.add(() -> player(participant, "answer", payload));
            }
            for (var result : executor.invokeAll(answers)) {
                Reply accepted = result.get();
                assertEquals(200, accepted.status, accepted.data.toString());
            }
            assertEquals(100, id(get("/games/" + a.code).data.get("answersCount")));
        } finally { executor.shutdownNow(); }
    }

    @Test
    void legacyNullTokensCannotAuthorizeActions() throws Exception {
        Arena a = arena(30, false);
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            var session = games.findByCodeForUpdate(a.code).orElseThrow();
            session.setHostToken(null);
            session.getPlayers().get(0).setPlayerToken(null);
        });
        assertEquals(403, host(a, "start", Map.of()).status);
        assertEquals(403, state(a).status);
    }

    @Test
    void organizerGateAndPublicResponsesDoNotExposeFutureQuestions() throws Exception {
        Arena a = arena(30, true);
        assertEquals(401, request("POST", "/quizzes", Map.of(), "X-Test-Request", "anonymous").status);
        assertEquals(401, request("POST", "/games/quiz/" + a.quiz, Map.of("powersEnabled", false), "X-Test-Request", "anonymous").status);
        assertEquals(401, request("GET", "/quizzes/" + a.quiz, null, null, null).status);
        var catalog = http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/quizzes?size=2")).GET().build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, catalog.statusCode());
        assertFalse(catalog.body().contains("options"));
        assertFalse(catalog.body().contains("questions"));
        assertEquals(400, get("/quizzes?size=51").status);
        begin(a);
        Reply lobby = request("GET", "/games/" + a.code, null, null, null);
        assertFalse(lobby.data.containsKey("players"));
        assertFalse(lobby.data.containsKey("currentQuestion"));
        @SuppressWarnings("unchecked") var summary = (Map<String, Object>) state(a).data.get("quiz");
        assertFalse(summary.containsKey("questions"));
        assertEquals(2, id(summary.get("questionCount")));
        assertTrue(state(a).data.containsKey("currentQuestion"));
        assertEquals(200, host(a, "end-question", Map.of("questionIndex", 0)).status);
        assertEquals(403, request("GET", "/games/" + a.code + "/question-stats", null, null, null).status);
        assertEquals(200, get("/games/" + a.code + "/question-stats").status);
    }

    @Test
    void organizerHttpLoginAndLogoutRevokeCreationAccess() throws Exception {
        assertEquals(401, request("POST", "/organizer/login", Map.of("password", "wrong-password"), null, null).status);
        Reply login = request("POST", "/organizer/login", Map.of("password", "testing-organizer-password"), null, null);
        assertEquals(200, login.status);
        String token = (String) login.data.get("organizerToken");
        assertEquals(200, request("POST", "/organizer/logout", null, "X-Organizer-Token", token).status);
        assertEquals(401, request("POST", "/quizzes", Map.of(), "X-Organizer-Token", token).status);
    }

    @Test
    @SuppressWarnings("unchecked")
    void diagnosticsAreHostOnlyAndExposeAnExplicitAnonymousAllowlist() throws Exception {
        Arena a = arena(30, false), b = arena(30, false);
        String path = "/games/" + a.code + "/diagnostics";
        assertEquals(403, request("GET", path, null, null, null).status);
        assertEquals(403, request("GET", path, null, "X-Player-Token", a.token).status);
        assertEquals(403, request("GET", path, null, "X-Host-Token", b.host).status);
        Reply reply = request("GET", path, null, "X-Host-Token", a.host);
        assertEquals(200, reply.status);
        assertEquals(Set.of("health", "activity", "admission"), reply.data.keySet());
        assertEquals(Set.of("overall", "memory", "processing", "connections"), ((Map<String, Object>) reply.data.get("health")).keySet());
        assertEquals(Set.of("requestsLastMinute", "limitedRequestsLastMinute", "failedRequestsLastMinute", "newPlayersLastMinute", "connectedSessions"),
            ((Map<String, Object>) reply.data.get("activity")).keySet());
        var admission = (Map<String, Object>) reply.data.get("admission");
        assertEquals(Set.of("activePlayers", "joinLocked", "canChangeEntries"), admission.keySet());
        assertEquals(1, id(admission.get("activePlayers")));
        String serialized = json.writeValueAsString(reply.data);
        assertFalse(serialized.contains("Aluno"));
        assertFalse(serialized.contains(a.host));
        assertFalse(serialized.contains(a.token));
        assertFalse(serialized.contains("127.0.0.1"));
        assertFalse(serialized.contains("testing-organizer-password"));
        var raw = http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api" + path))
            .header("X-Host-Token", a.host).GET().build(), HttpResponse.BodyHandlers.ofString());
        assertEquals("no-store", raw.headers().firstValue("Cache-Control").orElseThrow());
    }

    @Test
    @SuppressWarnings("unchecked")
    void diagnosticsStayScopedAndEntryControlsPreserveExistingPlayers() throws Exception {
        Arena a = arena(30, false), b = arena(30, false);
        String path = "/games/" + a.code + "/diagnostics";
        Reply before = request("GET", path, null, "X-Host-Token", a.host);
        var activity = (Map<String, Object>) before.data.get("activity");
        assertEquals(1, id(activity.get("newPlayersLastMinute")));
        assertEquals(200, request("GET", "/games/" + b.code, null, null, null).status);
        Reply after = request("GET", path, null, "X-Host-Token", a.host);
        assertEquals(activity, after.data.get("activity"), "Outro jogo e consultas do painel não alteram as contagens desta sala.");
        assertEquals(200, host(a, "lobby-lock", Map.of("enable", true)).status);
        Reply locked = request("GET", path, null, "X-Host-Token", a.host);
        assertEquals(true, ((Map<String, Object>) locked.data.get("admission")).get("joinLocked"));
        assertEquals(409, request("POST", "/games/" + a.code + "/players", Map.of("nickname", "Entrada fechada"), null, null).status);
        assertEquals(200, state(a).status);
        assertEquals(200, host(a, "lobby-lock", Map.of("enable", false)).status);
        begin(a);
        Reply playing = request("GET", path, null, "X-Host-Token", a.host);
        assertEquals(false, ((Map<String, Object>) playing.data.get("admission")).get("canChangeEntries"));
        assertEquals(409, host(a, "lobby-lock", Map.of("enable", false)).status);
    }

    @Test
    void signedBrowserIdentityPreventsExtraPlayersAndHostCanCloseOrRemove() throws Exception {
        Arena a = arena(30, false);
        var browser = HttpClient.newBuilder().cookieHandler(new java.net.CookieManager(null, java.net.CookiePolicy.ACCEPT_ALL)).build();
        URI join = URI.create("http://localhost:" + port + "/api/games/" + a.code + "/players");
        var first = browser.send(HttpRequest.newBuilder(join).header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString("{\"nickname\":\"Mesmo navegador\"}")).build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, first.statusCode());
        @SuppressWarnings("unchecked") var firstData = json.readValue(first.body(), Map.class);
        assertTrue(first.headers().firstValue("Set-Cookie").orElseThrow().contains("HttpOnly"));
        assertEquals(200, host(a, "lobby-lock", Map.of("enable", true)).status);
        assertEquals(409, request("POST", "/games/" + a.code + "/players", Map.of("nickname", "Nova entrada"), null, null).status);
        var repeated = browser.send(HttpRequest.newBuilder(join).header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString("{\"nickname\":\"Outra identidade\"}")).build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, repeated.statusCode());
        @SuppressWarnings("unchecked") var repeatedData = json.readValue(repeated.body(), Map.class);
        assertEquals(firstData.get("id"), repeatedData.get("id"));
        assertEquals(firstData.get("playerToken"), repeatedData.get("playerToken"));
        assertEquals(403, request("DELETE", "/games/" + a.code + "/players/" + firstData.get("id"), null, null, null).status);
        assertEquals(200, request("DELETE", "/games/" + a.code + "/players/" + firstData.get("id"), null, "X-Host-Token", a.host).status);
        assertEquals(403, request("GET", "/games/" + a.code + "/players/" + firstData.get("id") + "/state", null,
            "X-Player-Token", (String) firstData.get("playerToken")).status);
        var removed = browser.send(HttpRequest.newBuilder(join).header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString("{\"nickname\":\"Tentativa de voltar\"}")).build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(403, removed.statusCode());
    }

    @Test
    void missingTimedAnswerBreaksStreakWithoutChangingManualSkip() throws Exception {
        Arena a = arena(30, false, 3);
        begin(a);
        assertEquals(200, player(a, "answer", answer(a, true)).status);
        assertEquals(200, host(a, "end-question", Map.of("questionIndex", 0)).status);
        assertEquals(200, host(a, "next", Map.of("questionIndex", 0)).status);
        rewind(a, 31000);
        assertEquals(200, host(a, "next", Map.of("questionIndex", 1)).status);
        var third = player(a, "answer", answer(a, true));
        assertEquals(200, third.status);
        assertEquals(0, id(third.data.get("streakBonus")));
        assertEquals(1, id(third.data.get("currentStreak")));
    }

    @Test
    void longAuditHeadersAndLargeBodiesDoNotCrashServer() throws Exception {
        var scan = http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/.env"))
            .header("User-Agent", "a".repeat(900)).GET().build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(403, scan.statusCode());
        var huge = http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/quizzes"))
            .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString("x".repeat(524289))).build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(413, huge.statusCode());
    }

    @Test
    void readingStateDoesNotWaitForArenaWriteLock() throws Exception {
        Arena a = arena(30, false);
        var acquired = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var executor = Executors.newSingleThreadExecutor();
        var holder = executor.submit(() -> new TransactionTemplate(transactions).executeWithoutResult(status -> {
            games.findByCodeForUpdate(a.code).orElseThrow(); acquired.countDown();
            try { release.await(5, TimeUnit.SECONDS); } catch (InterruptedException ex) { Thread.currentThread().interrupt(); }
        }));
        try {
            assertTrue(acquired.await(3, TimeUnit.SECONDS));
            var response = request("GET", "/games/" + a.code, null, "X-Host-Token", a.host);
            assertEquals(200, response.status);
            assertEquals(1, release.getCount(), "A leitura precisa terminar enquanto a escrita ainda detém o bloqueio.");
        } finally { release.countDown(); holder.get(5, TimeUnit.SECONDS); executor.shutdownNow(); }
    }

    @Test
    void expirationAndRetentionCleanRelatedAnswersWithoutDeletingQuiz() throws Exception {
        Arena a = arena(30, false), b = arena(30, false);
        begin(a);
        assertEquals(200, player(a, "answer", answer(a, true)).status);
        assertEquals(200, host(a, "end-question", Map.of("questionIndex", 0)).status);
        assertEquals(200, host(a, "next", Map.of("questionIndex", 0)).status);
        assertEquals(200, host(a, "end-question", Map.of("questionIndex", 1)).status);
        assertEquals(200, host(a, "next", Map.of("questionIndex", 1)).status);
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            org.springframework.test.util.ReflectionTestUtils.setField(games.findByCodeForUpdate(a.code).orElseThrow(), "createdAt", java.time.Instant.now().minusSeconds(31 * 86400L));
            org.springframework.test.util.ReflectionTestUtils.setField(games.findByCodeForUpdate(b.code).orElseThrow(), "createdAt", java.time.Instant.now().minusSeconds(13 * 3600L));
        });
        service.expireOldGames();
        assertTrue(games.findByCode(a.code).isEmpty());
        assertTrue(games.findByCode(b.code).orElseThrow().isExpired());
        assertEquals(410, state(b).status);
        assertEquals(200, request("GET", "/quizzes/" + a.quiz, null, "X-Organizer-Token", (String) organizers.login("testing-organizer-password").get("organizerToken")).status);
    }

    private class Socket implements WebSocket.Listener, AutoCloseable {
        final BlockingQueue<String> messages = new LinkedBlockingQueue<>();
        final StringBuilder text = new StringBuilder();
        WebSocket connection;
        Socket() throws Exception {
            connection = http.newWebSocketBuilder().header("Origin", "http://localhost:5173")
                .buildAsync(URI.create("ws://localhost:" + port + "/ws"), this).get(5, TimeUnit.SECONDS);
        }
        @Override public void onOpen(WebSocket socket) { socket.request(1); }
        @Override public CompletionStage<?> onText(WebSocket socket, CharSequence data, boolean last) {
            text.append(data);
            if (last) { messages.add(text.toString()); text.setLength(0); }
            socket.request(1); return null;
        }
        @Override public CompletionStage<?> onClose(WebSocket socket, int status, String reason) { messages.add("CLOSED"); return null; }
        void send(String frame) { connection.sendText(frame + "\0", true).join(); }
        String waitFor(String prefix) throws Exception {
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
            while (System.nanoTime() < deadline) {
                String frame = messages.poll(100, TimeUnit.MILLISECONDS);
                if (frame != null && frame.contains(prefix)) return frame;
            }
            fail("Frame esperado não chegou: " + prefix); return "";
        }
        void connect(Arena arena) throws Exception {
            send("CONNECT\naccept-version:1.2\nheart-beat:10000,10000\narenaCode:" + arena.code + "\nplayerId:" + arena.player + "\nplayerToken:" + arena.token + "\n\n");
            waitFor("CONNECTED");
        }
        @Override public void close() { connection.abort(); }
    }

    @Test
    void realWebSocketsRequireMembershipAndDeliverOnlyOneSubscription() throws Exception {
        Arena a = arena(30, false), b = arena(30, false);
        try (var anonymous = new Socket()) {
            anonymous.send("CONNECT\naccept-version:1.2\n\n");
            anonymous.waitFor("ERROR");
        }
        try (var foreign = new Socket()) {
            foreign.connect(a);
            foreign.send("SUBSCRIBE\nid:foreign\ndestination:/topic/game/" + b.code + "\n\n");
            foreign.waitFor("ERROR");
        }
        try (var member = new Socket()) {
            member.connect(a);
            member.send("SUBSCRIBE\nid:first\ndestination:/topic/game/" + a.code + "\n\n");
            var header = org.springframework.messaging.simp.SimpMessageHeaderAccessor.create(org.springframework.messaging.simp.SimpMessageType.MESSAGE);
            header.setDestination("/topic/game/" + a.code);
            var probe = org.springframework.messaging.support.MessageBuilder.createMessage(new byte[0], header.getMessageHeaders());
            await(() -> !broker.getSubscriptionRegistry().findSubscriptions(probe).isEmpty(), 3000);
            assertEquals(200, host(a, "start", Map.of()).status);
            member.waitFor("GAME_STARTED");
            member.send("SUBSCRIBE\nid:duplicate\ndestination:/topic/game/" + a.code + "\n\n");
            member.waitFor("ERROR");
        }
        try (var removed = new Socket()) {
            removed.connect(b);
            assertEquals(200, request("DELETE", "/games/" + b.code + "/players/" + b.player, null, "X-Host-Token", b.host).status);
            removed.waitFor("CLOSED");
        }
    }

    private void await(BooleanSupplier condition, long timeout) throws Exception {
        long deadline = System.currentTimeMillis() + timeout;
        while (!condition.getAsBoolean() && System.currentTimeMillis() < deadline) Thread.sleep(25);
        assertTrue(condition.getAsBoolean(), "O relógio do servidor não avançou a partida no prazo.");
    }
}
