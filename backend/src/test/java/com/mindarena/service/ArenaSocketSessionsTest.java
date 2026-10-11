package com.mindarena.service;

import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketSession;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ArenaSocketSessionsTest {
    @Test
    void roomCountsAreSeparatedAndCannotSurviveClosedConnections() throws Exception {
        var sockets = new ArenaSocketSessions();
        WebSocketSession first = mock(WebSocketSession.class), second = mock(WebSocketSession.class);
        when(first.getId()).thenReturn("first");
        when(second.getId()).thenReturn("second");
        assertTrue(sockets.add(first));
        assertTrue(sockets.add(second));
        sockets.bind("first", "first-token", "ABC234");
        sockets.bind("second", "second-token", "XYZ234");
        assertEquals(1, sockets.countForArena("ABC234"));
        assertEquals(1, sockets.countForArena("XYZ234"));
        sockets.revoke("first-token");
        verify(first).close(org.springframework.web.socket.CloseStatus.POLICY_VIOLATION);
        assertEquals(0, sockets.countForArena("ABC234"));
        assertEquals(1, sockets.countForArena("XYZ234"));
        assertThrows(SecurityException.class, () -> sockets.bind("first", "first-token", "ABC234"));
        sockets.remove("second");
        assertEquals(0, sockets.countForArena("XYZ234"));
    }
}
