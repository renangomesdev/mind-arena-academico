package com.mindarena.repository;

import com.mindarena.model.GameSession;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.List;
import com.mindarena.model.GameStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GameSessionRepository extends JpaRepository<GameSession, Long> {
    Optional<GameSession> findByCode(String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select g from GameSession g where g.code = :code")
    Optional<GameSession> findByCodeForUpdate(@Param("code") String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.QueryHints(@jakarta.persistence.QueryHint(name = "jakarta.persistence.lock.timeout", value = "0"))
    @Query("select g from GameSession g where g.code = :code")
    Optional<GameSession> findByCodeForClock(@Param("code") String code);

    long countByStatusNotIn(List<GameStatus> statuses);
    List<GameSession> findByCreatedAtBeforeAndStatusNotIn(java.time.Instant cutoff, List<GameStatus> statuses, org.springframework.data.domain.Pageable page);
    List<GameSession> findByCreatedAtBeforeAndStatusIn(java.time.Instant cutoff, List<GameStatus> statuses, org.springframework.data.domain.Pageable page);

    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying
    @Query(value = "update game_session set created_at = CURRENT_TIMESTAMP where created_at is null", nativeQuery = true)
    void initializeLegacyCreationDates();

    @Query("select g.code from GameSession g where g.status in :statuses")
    List<String> findRunningCodes(@Param("statuses") List<GameStatus> statuses);
}
