package com.mindarena;

import com.mindarena.service.OrganizerService;
import com.mindarena.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import java.net.URI;
import java.net.http.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "arena.max-active-games=1", "spring.datasource.url=jdbc:h2:mem:quota-tests;MODE=PostgreSQL;DB_CLOSE_DELAY=-1"
})
@ActiveProfiles("test")
class ResourceQuotaIntegrationTest {
    @LocalServerPort int port;
    @Autowired OrganizerService organizers;
    @Autowired QuizRepository quizzes;
    @Autowired GameSessionRepository games;

    @Test void twoConcurrentCreatorsCannotExceedDatabaseQuota() throws Exception {
        String token = (String) organizers.login("testing-organizer-password").get("organizerToken");
        long quizId = quizzes.findAll().get(0).getId();
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/games/quiz/" + quizId))
            .header("X-Organizer-Token", token).header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString("{\"powersEnabled\":false}")).build();
        var http = HttpClient.newHttpClient();
        var executor = Executors.newFixedThreadPool(2);
        try {
            var results = executor.invokeAll(List.<Callable<Integer>>of(
                () -> http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode(),
                () -> http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode()));
            var codes = new ArrayList<Integer>();
            for (var result : results) codes.add(result.get());
            Collections.sort(codes);
            assertEquals(List.of(200, 429), codes);
            assertEquals(1, games.count());
        } finally { executor.shutdownNow(); }
    }
}
