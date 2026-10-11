package com.mindarena.config;

import com.mindarena.model.Quiz;
import com.mindarena.repository.GameSessionRepository;
import com.mindarena.repository.QuizRepository;
import com.mindarena.repository.ResourceQuotaRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {
    "arena.seed-demo-quiz=false",
    "spring.datasource.url=jdbc:h2:mem:seed-disabled;MODE=PostgreSQL;DB_CLOSE_DELAY=-1"
})
@ActiveProfiles("test")
class DataLoaderIntegrationTest {
    @Autowired QuizRepository quizzes;
    @Autowired ResourceQuotaRepository quotas;
    @Autowired GameSessionRepository games;

    @Test void disabledDemoPreservesExistingContentAndRequiredDatabaseState() throws Exception {
        assertEquals(0, quizzes.count());
        assertTrue(quotas.existsById("games"));
        assertTrue(quotas.existsById("quizzes"));
        var original = quizzes.save(new Quiz("Quiz próprio", "Conteúdo de uma instalação"));
        new DataLoader().initDatabase(quizzes, quotas, games, false).run();
        assertEquals(1, quizzes.count());
        var preserved = quizzes.findById(original.getId()).orElseThrow();
        assertEquals("Quiz próprio", preserved.getTitle());
        assertEquals("Conteúdo de uma instalação", preserved.getDescription());
    }
}
