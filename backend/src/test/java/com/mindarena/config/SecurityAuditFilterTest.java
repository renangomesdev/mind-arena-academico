package com.mindarena.config;

import com.mindarena.service.SecurityAuditService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

public class SecurityAuditFilterTest {

    private SecurityAuditService auditService;
    private SecurityAuditFilter filter;
    private FilterChain filterChain;
    private com.mindarena.service.CredentialRegistry credentials;

    @BeforeEach
    void setUp() {
        auditService = mock(SecurityAuditService.class);
        credentials = new com.mindarena.service.CredentialRegistry();
        filter = new SecurityAuditFilter(auditService, credentials);
        filterChain = mock(FilterChain.class);
    }

    @Test
    @DisplayName("1. Bloqueio de Probing: Tentativa de acesso a /.env deve retornar HTTP 403")
    void testBlockForbiddenPath_Env() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/.env");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        assertEquals(403, response.getStatus());
        verify(filterChain, never()).doFilter(any(), any());
        verify(auditService).recordEvent(anyString(), eq("GET"), eq("/.env"), eq("FORBIDDEN_RESOURCE_SCAN"), eq("HIGH"), anyString(), anyString(), eq(true));
    }

    @Test
    @DisplayName("2. Bloqueio de Scanner: Tentativa de varredura em /wp-admin deve retornar HTTP 403")
    void testBlockForbiddenPath_WpAdmin() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/wp-admin/setup.php");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        assertEquals(403, response.getStatus());
        verify(filterChain, never()).doFilter(any(), any());
        verify(auditService).recordEvent(anyString(), eq("GET"), eq("/wp-admin/setup.php"), eq("FORBIDDEN_RESOURCE_SCAN"), eq("HIGH"), anyString(), anyString(), eq(true));
    }

    @Test
    @DisplayName("3. Bloqueio de SSRF: Tentativa de sondagem a IP de Metadata (169.254.169.254) deve retornar HTTP 403")
    void testBlockSSRF_MetadataIP() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/proxy");
        request.setQueryString("url=http://169.254.169.254/latest/meta-data");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        assertEquals(403, response.getStatus());
        verify(filterChain, never()).doFilter(any(), any());
        verify(auditService).recordEvent(anyString(), eq("GET"), contains("169.254.169.254"), eq("SSRF_PRIVATE_IP_PROBE"), eq("CRITICAL"), anyString(), anyString(), eq(true));
    }

    @Test
    @DisplayName("4. Bloqueio de Path Traversal: Tentativa de ler /etc/passwd deve retornar HTTP 403")
    void testBlockPathTraversal() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/files/..%2f..%2f/etc/passwd");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        assertEquals(403, response.getStatus());
        verify(filterChain, never()).doFilter(any(), any());
        verify(auditService).recordEvent(anyString(), eq("GET"), anyString(), eq("PATH_TRAVERSAL_ATTEMPT"), eq("HIGH"), anyString(), anyString(), eq(true));
    }

    @Test
    @DisplayName("5. Bloqueio de SQL Injection: Payload com UNION SELECT deve retornar HTTP 403")
    void testBlockSQLInjection() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/quizzes");
        request.setQueryString("search=1' UNION SELECT * FROM users--");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        assertEquals(403, response.getStatus());
        verify(filterChain, never()).doFilter(any(), any());
        verify(auditService).recordEvent(anyString(), eq("GET"), anyString(), eq("INJECTION_ATTEMPT"), eq("CRITICAL"), anyString(), anyString(), eq(true));
    }

    @Test
    @DisplayName("6. Simulação de Ataque DoS / Flood: Disparo de 100 requisições simultâneas")
    void testRateLimit_DoS() throws ServletException, IOException {
        String attackerIp = "203.0.113.199";
        int totalRequests = 100;
        int allowedCount = 0;
        int blockedCount = 0;
        credentials.remember("AB12CD", "11111111-1111-1111-1111-111111111111");

        for (int i = 1; i <= totalRequests; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/games/AB12CD");
            req.setRemoteAddr(attackerIp);
            req.addHeader("X-Player-Token", "11111111-1111-1111-1111-111111111111");
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(req, res, filterChain);

            if (res.getStatus() == 200) {
                allowedCount++;
            } else if (res.getStatus() == 429) {
                blockedCount++;
            }
        }

        System.out.println("==================================================");
        System.out.println("🔥 RELATÓRIO DO TESTE DE SIMULAÇÃO DE ATAQUE DoS/FLOOD:");
        System.out.println("🎯 Alvo: /api/quizzes");
        System.out.println("🌐 IP Atacante Simulado: " + attackerIp);
        System.out.println("📦 Total de Requisições Disparadas: " + totalRequests);
        System.out.println("✅ Requisições Permitidas (Dentro do Limite): " + allowedCount);
        System.out.println("🛑 Requisições Bloqueadas com HTTP 429 (Mitigadas): " + blockedCount);
        System.out.println("🛡️ Taxa de Mitigação do Ataque: " + (blockedCount * 100 / totalRequests) + "%");
        System.out.println("==================================================");

        assertEquals(40, allowedCount, "Deveria permitir exatamente 40 requisições");
        assertEquals(60, blockedCount, "Deveria bloquear 60 requisições com HTTP 429");
        verify(auditService, atLeastOnce()).recordEvent(eq(attackerIp), eq("GET"), eq("/api/games/AB12CD"), eq("DOS_RATE_LIMIT_EXCEEDED"), eq("HIGH"), anyString(), anyString(), eq(true));
    }

    @Test
    @DisplayName("7. Tráfego Legítimo: Requisições normais devem ser aprovadas e prosseguir na cadeia de filtros")
    void testAllowLegitimateTraffic() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/games/AB12CD");
        request.setRemoteAddr("198.51.100.10");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        assertEquals(200, response.getStatus());
        verify(filterChain, times(1)).doFilter(request, response);
        verify(auditService, never()).recordEvent(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), anyBoolean());
    }

    @Test
    void allowsOneHundredPlayersOnTheSameNetwork() throws Exception {
        for (int i = 0; i < 100; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/games/AB12CD/answer");
            request.setRemoteAddr("198.51.100.30");
            request.addHeader("X-Player-Token", java.util.UUID.randomUUID().toString());
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(request, response, filterChain);
            assertEquals(200, response.getStatus());
        }
    }

    @Test
    void spoofedForwardingHeadersDoNotRotateTheRateLimit() throws Exception {
        for (int i = 0; i <= 300; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/quizzes");
            request.setRemoteAddr("198.51.100.40");
            request.addHeader("X-Forwarded-For", "203.0.113." + i);
            request.addHeader("X-Real-IP", "203.0.113." + i);
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(request, response, filterChain);
            assertEquals(i < 300 ? 200 : 429, response.getStatus());
        }
    }

    @Test
    void inventedTokensCannotRotateAnonymousLimits() throws Exception {
        for (int i = 0; i <= 310; i++) {
            var request = new MockHttpServletRequest("GET", "/api/games/AB12CD");
            request.setRemoteAddr("198.51.100.60");
            request.addHeader("X-Player-Token", java.util.UUID.randomUUID().toString());
            var response = new MockHttpServletResponse();
            filter.doFilter(request, response, filterChain);
            assertEquals(i < 300 ? 200 : 429, response.getStatus());
        }
    }

    @Test
    void issuedArenaTokenDoesNotPartitionPublicCatalogTraffic() throws Exception {
        String token = java.util.UUID.randomUUID().toString();
        credentials.remember("AB12CD", token);
        for (int i = 0; i <= 300; i++) {
            var request = new MockHttpServletRequest("GET", "/api/quizzes");
            request.setRemoteAddr("198.51.100.61");
            request.addHeader("X-Player-Token", token);
            var response = new MockHttpServletResponse();
            filter.doFilter(request, response, filterChain);
            assertEquals(i < 300 ? 200 : 429, response.getStatus());
        }
    }

    @Test
    void organizerLoginRateLimitCountsPostsAndPreservesPreflightRequests() throws Exception {
        for (int i = 0; i < 6; i++) {
            var preflight = new MockHttpServletRequest("OPTIONS", "/api/organizer/login");
            var preflightResponse = new MockHttpServletResponse();
            filter.doFilter(preflight, preflightResponse, filterChain);
            assertEquals(200, preflightResponse.getStatus());
            var request = new MockHttpServletRequest("POST", "/api/organizer/login");
            var response = new MockHttpServletResponse();
            filter.doFilter(request, response, filterChain);
            assertEquals(i < 5 ? 200 : 429, response.getStatus());
        }
    }
}
