package com.mindarena.repository;

import com.mindarena.model.Player;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PlayerRepository extends JpaRepository<Player, Long> {
    List<Player> findByGameSessionIdOrderByScoreDesc(Long gameSessionId);
    List<Player> findByGameSessionIdAndRemovedFalseOrderByScoreDesc(Long gameSessionId);
    java.util.Optional<Player> findByGameSessionIdAndDeviceId(Long gameSessionId, String deviceId);
    long countByGameSessionIdAndRemovedFalse(Long gameSessionId);
    boolean existsByGameSessionIdAndNickname(Long gameSessionId, String nickname);
}
