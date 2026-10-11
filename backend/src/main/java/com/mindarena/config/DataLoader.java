package com.mindarena.config;

import com.mindarena.model.AnswerOption;
import com.mindarena.model.Question;
import com.mindarena.model.Quiz;
import com.mindarena.model.ResourceQuota;
import com.mindarena.repository.GameSessionRepository;
import com.mindarena.repository.QuizRepository;
import com.mindarena.repository.ResourceQuotaRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class DataLoader {
    @Bean
    CommandLineRunner initDatabase(QuizRepository repository, ResourceQuotaRepository quotas,
            GameSessionRepository games, @Value("${arena.seed-demo-quiz:true}") boolean seedDemoQuiz) {
        return args -> {
            for (String id : List.of("games", "quizzes")) {
                if (!quotas.existsById(id)) quotas.save(new ResourceQuota(id));
            }
            games.initializeLegacyCreationDates();
            if (seedDemoQuiz) seedDemoQuiz(repository);
        };
    }

    private void seedDemoQuiz(QuizRepository repository) {
        String title = "Quiz de demonstração";
        if (repository.existsByTitle(title)) return;
        Quiz quiz = new Quiz(title, "Exemplo público para conhecer a arena. Crie seus próprios quizzes na área do organizador.");
        quiz.addQuestion(question("Quanto é 2 + 2?", "Some dois pares.", 1,
            "4", "3", "5", "6"));
        quiz.addQuestion(question("Qual destes é um planeta do Sistema Solar?", "É conhecido como planeta vermelho.", 2,
            "Marte", "Lua", "Sol", "Estrela Polar"));
        quiz.addQuestion(question("Qual figura geométrica tem três lados?", "Seu nome começa com tri.", 3,
            "Triângulo", "Quadrado", "Círculo", "Retângulo"));
        repository.save(quiz);
    }

    private Question question(String text, String hint, int order, String correct, String... others) {
        Question question = new Question();
        question.setText(text);
        question.setHint(hint);
        question.setTimeLimitSeconds(20);
        question.setOrderIndex(order);
        question.addOption(new AnswerOption(correct, true));
        for (String option : others) question.addOption(new AnswerOption(option, false));
        return question;
    }
}
