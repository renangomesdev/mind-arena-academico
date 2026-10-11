package com.mindarena.service;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

class OrganizerServiceTest {
    @Test void missingOrShortPasswordKeepsCreationClosed() {
        for (String password : new String[] {"", "short", "            "}) {
            var service = new OrganizerService(password);
            assertEquals(503, assertThrows(ResponseStatusException.class, () -> service.login(password)).getStatusCode().value());
            assertEquals(401, assertThrows(ResponseStatusException.class, () -> service.requireAccess("invented")).getStatusCode().value());
        }
    }
    @Test void correctPasswordOpensOnlyIssuedSessionAndLogoutRevokesIt() {
        var service = new OrganizerService("testing-organizer-password");
        assertEquals(401, assertThrows(ResponseStatusException.class, () -> service.login("wrong")).getStatusCode().value());
        String token = (String) service.login("testing-organizer-password").get("organizerToken");
        assertDoesNotThrow(() -> service.requireAccess(token));
        service.logout(token);
        assertEquals(401, assertThrows(ResponseStatusException.class, () -> service.requireAccess(token)).getStatusCode().value());
    }
}
