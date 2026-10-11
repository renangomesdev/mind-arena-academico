package com.mindarena.controller;

import com.mindarena.model.Quiz;
import com.mindarena.dto.QuizDTO;
import com.mindarena.service.QuizService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/quizzes")
public class QuizController {

    private final QuizService quizService;
    private final com.mindarena.service.OrganizerService organizers;

    public QuizController(QuizService quizService, com.mindarena.service.OrganizerService organizers) {
        this.quizService = quizService;
        this.organizers = organizers;
    }

    @GetMapping
    public List<com.mindarena.dto.QuizSummary> getAllQuizzes(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return quizService.getSummaries(page, size);
    }

    @GetMapping("/{id}")
    public Quiz getQuizById(@PathVariable Long id, @RequestHeader(value = "X-Organizer-Token", required = false) String token) {
        organizers.requireAccess(token);
        return quizService.getQuizById(id);
    }

    @PostMapping
    public Quiz createQuiz(@RequestBody QuizDTO quizDTO, @RequestHeader(value = "X-Organizer-Token", required = false) String token) {
        organizers.requireAccess(token);
        return quizService.createQuiz(quizDTO);
    }
}
