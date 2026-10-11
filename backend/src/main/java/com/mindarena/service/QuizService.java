package com.mindarena.service;

import com.mindarena.model.Quiz;
import com.mindarena.model.Question;
import com.mindarena.model.AnswerOption;
import com.mindarena.dto.QuizDTO;
import com.mindarena.dto.QuestionDTO;
import com.mindarena.dto.AnswerOptionDTO;
import com.mindarena.repository.QuizRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Service
public class QuizService {
    
    private final QuizRepository quizRepository;
    private final ResourceQuotaService quotas;

    public QuizService(QuizRepository quizRepository, ResourceQuotaService quotas) {
        this.quizRepository = quizRepository;
        this.quotas = quotas;
    }

    @Transactional(readOnly = true)
    public List<com.mindarena.dto.QuizSummary> getSummaries(int page, int size) {
        if (page < 0 || page > 10000 || size < 1 || size > 50) throw new IllegalArgumentException("Página inválida.");
        return quizRepository.findAll(org.springframework.data.domain.PageRequest.of(page, size,
            org.springframework.data.domain.Sort.by("id").descending())).stream().map(com.mindarena.dto.QuizSummary::from).toList();
    }

    public List<Quiz> getAllQuizzes() {
        return quizRepository.findAll();
    }

    public Quiz getQuizById(Long id) {
        return quizRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Quiz não encontrado."));
    }

    @Transactional
    public Quiz createQuiz(QuizDTO dto) {
        quotas.beforeQuiz();
        if (dto == null || dto.getTitle() == null || dto.getTitle().trim().isEmpty()) {
            throw new IllegalArgumentException("Título do quiz é obrigatório.");
        }
        String cleanTitle = dto.getTitle().trim();
        if (cleanTitle.length() > 150) {
            throw new IllegalArgumentException("Título do quiz deve ter no máximo 150 caracteres.");
        }
        String cleanDesc = dto.getDescription() != null ? dto.getDescription().trim() : "";
        if (cleanDesc.length() > 500) {
            throw new IllegalArgumentException("Descrição do quiz deve ter no máximo 500 caracteres.");
        }
        if (dto.getQuestions() == null || dto.getQuestions().isEmpty()) {
            throw new IllegalArgumentException("O quiz deve possuir pelo menos 1 pergunta.");
        }
        if (dto.getQuestions().size() > 50) {
            throw new IllegalArgumentException("O quiz pode ter no máximo 50 perguntas.");
        }

        Quiz quiz = new Quiz(cleanTitle, cleanDesc);
        
        int order = 1;
        for (QuestionDTO qDto : dto.getQuestions()) {
            if (qDto == null || qDto.getText() == null || qDto.getText().trim().isEmpty()) {
                throw new IllegalArgumentException("Enunciado da pergunta não pode ser vazio.");
            }
            String cleanQText = qDto.getText().trim();
            if (cleanQText.length() > 300) {
                throw new IllegalArgumentException("Enunciado da pergunta deve ter no máximo 300 caracteres.");
            }
            if (qDto.getOptions() == null || qDto.getOptions().size() < 2 || qDto.getOptions().size() > 5) {
                throw new IllegalArgumentException("Cada pergunta deve ter entre 2 e 5 alternativas.");
            }
            if (qDto.getOptions().stream().anyMatch(java.util.Objects::isNull)) throw new IllegalArgumentException("Alternativa inválida.");
            long correctCount = qDto.getOptions().stream().filter(AnswerOptionDTO::getIsCorrect).count();
            if (correctCount != 1) {
                throw new IllegalArgumentException("Cada pergunta deve ter exatamente uma alternativa correta.");
            }
            if (qDto.getHint() != null && qDto.getHint().trim().length() > 500) throw new IllegalArgumentException("Dica deve ter no máximo 500 caracteres.");
            if (qDto.getTimeLimitSeconds() != null && (qDto.getTimeLimitSeconds() < 1 || qDto.getTimeLimitSeconds() > 300)) {
                throw new IllegalArgumentException("Tempo da pergunta deve estar entre 1 e 300 segundos.");
            }

            Question q = new Question();
            q.setText(cleanQText);
            q.setHint(qDto.getHint() != null ? qDto.getHint().trim() : null);
            q.setTimeLimitSeconds(qDto.getTimeLimitSeconds() != null && qDto.getTimeLimitSeconds() > 0 ? qDto.getTimeLimitSeconds() : 15);
            q.setOrderIndex(order++);
            
            for (AnswerOptionDTO oDto : qDto.getOptions()) {
                String optText = oDto.getText() != null ? oDto.getText().trim() : "";
                if (optText.isEmpty()) {
                    throw new IllegalArgumentException("Texto da alternativa não pode ser vazio.");
                }
                if (optText.length() > 200) {
                    throw new IllegalArgumentException("Texto da alternativa deve ter no máximo 200 caracteres.");
                }
                q.addOption(new AnswerOption(optText, Boolean.TRUE.equals(oDto.getIsCorrect())));
            }
            quiz.addQuestion(q);
        }
        
        return quizRepository.save(quiz);
    }
}
