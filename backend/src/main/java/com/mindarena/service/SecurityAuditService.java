package com.mindarena.service;

import com.mindarena.model.SecurityAuditLog;
import com.mindarena.repository.SecurityAuditLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class SecurityAuditService {

    private static final Logger log = LoggerFactory.getLogger(SecurityAuditService.class);
    private final SecurityAuditLogRepository auditRepo;
    private final org.springframework.transaction.support.TransactionTemplate transaction;
    private final Map<String, Long> recent = new java.util.concurrent.ConcurrentHashMap<>();
    private long nextCleanup;
    private long budgetStart;
    private int budgetCount;

    public SecurityAuditService(SecurityAuditLogRepository auditRepo, org.springframework.transaction.PlatformTransactionManager manager) {
        this.auditRepo = auditRepo;
        transaction = new org.springframework.transaction.support.TransactionTemplate(manager);
        transaction.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        transaction.setTimeout(3);
    }

    public SecurityAuditLog recordEvent(String clientIp, String method, String uri,
                                        String threatType, String severity, String details,
                                        String userAgent, boolean blocked) {
        if (!allowEvent(clientIp, threatType)) return null;
        try {
            SecurityAuditLog auditLog = new SecurityAuditLog(
                clip(clientIp, 255), clip(method, 255), clip(uri, 1000), clip(threatType, 255), clip(severity, 255),
                clip(details, 2000), clip(userAgent, 500), blocked
            );
            
            log.warn("[SECURITY-ALERT] [{}] IP: {} | Threat: {} | Severity: {} | URI: {} | Details: {}",
                blocked ? "BLOCKED" : "AUDITED", auditLog.getClientIp(), auditLog.getThreatType(), auditLog.getSeverity(), auditLog.getRequestUri(), auditLog.getDetails());
            
            // execute returns only after commit; failures at flush/commit are also contained here.
            return transaction.execute(status -> auditRepo.saveAndFlush(auditLog));
        } catch (Exception e) {
            log.error("Failed to record security audit log: {}", e.getMessage());
            return null;
        }
    }

    private static String clip(String value, int max) {
        if (value == null) return "";
        String normalized = value.replaceAll("[\\p{Cntrl}]", " ");
        return normalized.length() > max ? normalized.substring(0, max) : normalized;
    }

    private synchronized boolean allowEvent(String ip, String threat) {
        long now = System.currentTimeMillis();
        if (now >= nextCleanup) { recent.entrySet().removeIf(e -> e.getValue() < now); nextCleanup = now + 60000; }
        String key = clip(ip, 255) + ':' + clip(threat, 255);
        if (recent.getOrDefault(key, 0L) > now) return false;
        if (now - budgetStart >= 60000) { budgetStart = now; budgetCount = 0; }
        if (budgetCount >= 60 || recent.size() >= 4096) return false;
        budgetCount++;
        recent.put(key, now + 10000);
        return true;
    }

    @org.springframework.scheduling.annotation.Scheduled(fixedDelay = 3600000, initialDelay = 60000)
    public void pruneLogs() {
        try {
            transaction.executeWithoutResult(status -> {
                auditRepo.deleteByTimestampBefore(java.time.LocalDateTime.now().minusDays(7));
                var overflow = auditRepo.findAll(org.springframework.data.domain.PageRequest.of(20000, 1, org.springframework.data.domain.Sort.by("id").descending()));
                if (!overflow.isEmpty()) auditRepo.deleteByIdLessThanEqual(overflow.getContent().get(0).getId());
            });
        } catch (RuntimeException ex) { log.error("Não foi possível remover registros antigos da auditoria: {}", ex.getClass().getSimpleName()); }
    }

    public List<SecurityAuditLog> getRecentLogs() {
        return auditRepo.findTop100ByOrderByTimestampDesc();
    }

    public Map<String, Object> getSecurityStats() {
        long totalThreats = auditRepo.count();
        long blockedThreats = auditRepo.countByBlockedTrue();
        long criticalThreats = auditRepo.countBySeverity("CRITICAL");
        long highThreats = auditRepo.countBySeverity("HIGH");

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalThreats", totalThreats);
        stats.put("blockedThreats", blockedThreats);
        stats.put("criticalThreats", criticalThreats);
        stats.put("highThreats", highThreats);
        return stats;
    }

}
