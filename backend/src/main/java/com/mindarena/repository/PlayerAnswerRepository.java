package com.mindarena.repository;

import com.mindarena.model.PlayerAnswer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PlayerAnswerRepository extends JpaRepository<PlayerAnswer, Long> {
    boolean existsByPlayerIdAndQuestionId(Long playerId, Long questionId);
    Optional<PlayerAnswer> findByPlayerIdAndQuestionId(Long playerId, Long questionId);
    List<PlayerAnswer> findByQuestionIdAndPlayerGameSessionId(Long questionId, Long gameSessionId);
    List<PlayerAnswer> findByPlayerGameSessionId(Long gameSessionId);
    List<PlayerAnswer> findByPlayerId(Long playerId);
    long countByQuestionIdAndPlayerGameSessionId(Long questionId, Long gameSessionId);
    long countByQuestionIdAndPlayerGameSessionIdAndPlayerRemovedFalse(Long questionId, Long gameSessionId);
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("delete from PlayerAnswer a where a.player.id in (select p.id from Player p where p.gameSession.id = :gameSessionId)")
    void deleteByPlayerGameSessionId(@org.springframework.data.repository.query.Param("gameSessionId") Long gameSessionId);
}
