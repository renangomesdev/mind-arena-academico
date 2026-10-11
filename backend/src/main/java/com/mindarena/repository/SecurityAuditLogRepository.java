package com.mindarena.repository;

import com.mindarena.model.SecurityAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SecurityAuditLogRepository extends JpaRepository<SecurityAuditLog, Long> {
    List<SecurityAuditLog> findTop100ByOrderByTimestampDesc();
    long countByBlockedTrue();
    long countBySeverity(String severity);
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("delete from SecurityAuditLog l where l.timestamp < :cutoff")
    void deleteByTimestampBefore(@org.springframework.data.repository.query.Param("cutoff") java.time.LocalDateTime cutoff);
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("delete from SecurityAuditLog l where l.id <= :id")
    void deleteByIdLessThanEqual(@org.springframework.data.repository.query.Param("id") Long id);
}
