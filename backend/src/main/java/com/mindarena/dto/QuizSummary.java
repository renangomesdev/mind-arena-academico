package com.mindarena.dto;

import com.mindarena.model.Quiz;

public record QuizSummary(Long id, String title, String description, int questionCount, boolean allHaveHints) {
    public static QuizSummary from(Quiz quiz) {
        return new QuizSummary(quiz.getId(), quiz.getTitle(), quiz.getDescription(), quiz.getQuestions().size(),
            !quiz.getQuestions().isEmpty() && quiz.getQuestions().stream().allMatch(q -> q.hasHint()));
    }
}
