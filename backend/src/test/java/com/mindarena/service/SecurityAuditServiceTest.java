package com.mindarena.service;

import com.mindarena.model.SecurityAuditLog;
import com.mindarena.repository.SecurityAuditLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

public class SecurityAuditServiceTest {

    private SecurityAuditLogRepository auditRepo;
    private SecurityAuditService auditService;

    @BeforeEach
    void setUp() {
        auditRepo = mock(SecurityAuditLogRepository.class);
        var manager = mock(org.springframework.transaction.PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenReturn(new org.springframework.transaction.support.SimpleTransactionStatus());
        auditService = new SecurityAuditService(auditRepo, manager);
    }

    @Test
    @DisplayName("Falha ao persistir auditoria não interrompe a resposta de segurança")
    void persistenceFailureIsContained() {
        when(auditRepo.saveAndFlush(any())).thenThrow(new IllegalStateException("database unavailable"));
        assertNull(auditService.recordEvent("192.0.2.45", "GET", "/.env", "SCAN", "HIGH", "", "", true));
    }

    @Test
    @DisplayName("O orçamento global limita eventos vindos de endereços diferentes")
    void globalBudgetCapsDistributedEvents() {
        when(auditRepo.saveAndFlush(any())).thenAnswer(call -> call.getArgument(0));
        for (int i = 1; i <= 60; i++) {
            assertNotNull(auditService.recordEvent("192.0.2." + i, "GET", "/.env", "SCAN", "HIGH", "", "", true));
        }
        assertNull(auditService.recordEvent("192.0.2.61", "GET", "/.env", "SCAN", "HIGH", "", "", true));
        verify(auditRepo, times(60)).saveAndFlush(any());
    }

    @Test
    @DisplayName("Campos de auditoria não conservam quebras de linha fornecidas pelo cliente")
    void normalizesControlCharactersBeforePersisting() {
        when(auditRepo.saveAndFlush(any())).thenAnswer(call -> call.getArgument(0));
        var result = auditService.recordEvent("192.0.2.45\r\nforged", "GET", "/path\nforged", "SCAN", "HIGH", "detail\tvalue", "agent\nforged", true);
        assertNotNull(result);
        assertEquals("192.0.2.45  forged", result.getClientIp());
        assertEquals("/path forged", result.getRequestUri());
        assertEquals("detail value", result.getDetails());
        assertEquals("agent forged", result.getUserAgent());
    }

    @Test
    @DisplayName("Cálculo de métricas de telemetria de segurança")
    void testSecurityStats() {
        when(auditRepo.count()).thenReturn(150L);
        when(auditRepo.countByBlockedTrue()).thenReturn(148L);
        when(auditRepo.countBySeverity("CRITICAL")).thenReturn(12L);
        when(auditRepo.countBySeverity("HIGH")).thenReturn(45L);

        Map<String, Object> stats = auditService.getSecurityStats();

        assertEquals(150L, stats.get("totalThreats"));
        assertEquals(148L, stats.get("blockedThreats"));
        assertEquals(12L, stats.get("criticalThreats"));
        assertEquals(45L, stats.get("highThreats"));
    }

    @Test
    void truncatesUntrustedFieldsAndAggregatesFloods() {
        when(auditRepo.saveAndFlush(any())).thenAnswer(call -> call.getArgument(0));
        var entry = auditService.recordEvent("ip", "GET", "x".repeat(2000), "SCAN", "HIGH", "d".repeat(4000), "u".repeat(900) + "\n", true);
        assertEquals(1000, entry.getRequestUri().length());
        assertEquals(500, entry.getUserAgent().length());
        assertEquals(2000, entry.getDetails().length());
        for (int i = 0; i < 100; i++) assertNull(auditService.recordEvent("ip", "GET", "other" + i, "SCAN", "HIGH", "", "", true));
        verify(auditRepo, times(1)).saveAndFlush(any());
    }

    @Test
    void commitFailureDoesNotBreakSecurityResponse() {
        var manager = mock(org.springframework.transaction.PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenReturn(new org.springframework.transaction.support.SimpleTransactionStatus());
        doThrow(new org.springframework.transaction.TransactionSystemException("test failure")).when(manager).commit(any());
        var failing = new SecurityAuditService(auditRepo, manager);
        when(auditRepo.saveAndFlush(any())).thenAnswer(call -> call.getArgument(0));
        assertNull(failing.recordEvent("ip", "GET", "/.env", "SCAN", "HIGH", "", "", true));
    }
}
