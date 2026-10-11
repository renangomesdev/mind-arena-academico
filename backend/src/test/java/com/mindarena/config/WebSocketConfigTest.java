package com.mindarena.config;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageBuilder;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class WebSocketConfigTest {
    @Test
    void rejectsForgedEventsAndWildcardSubscriptions() {
        ChannelRegistration registration = mock(ChannelRegistration.class);
        when(registration.taskExecutor()).thenReturn(mock(org.springframework.messaging.simp.config.TaskExecutorRegistration.class, RETURNS_SELF));
        new WebSocketConfig(mock(com.mindarena.service.ArenaAccessService.class), mock(com.mindarena.service.ArenaSocketSessions.class),
            new ArenaOrigins("http://localhost:5173")).configureClientInboundChannel(registration);
        ArgumentCaptor<ChannelInterceptor> capture = ArgumentCaptor.forClass(ChannelInterceptor.class);
        verify(registration).interceptors(capture.capture());
        ChannelInterceptor interceptor = capture.getValue();
        var send = StompHeaderAccessor.create(StompCommand.SEND);
        send.setDestination("/topic/game/ABC234");
        var forged = MessageBuilder.createMessage(new byte[0], send.getMessageHeaders());
        assertThrows(SecurityException.class, () -> interceptor.preSend(forged, null));
        var subscribe = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        subscribe.setDestination("/topic/game/**");
        var wildcard = MessageBuilder.createMessage(new byte[0], subscribe.getMessageHeaders());
        assertThrows(SecurityException.class, () -> interceptor.preSend(wildcard, null));
        var validSubscription = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        var attributes = new java.util.HashMap<String, Object>();
        validSubscription.setSessionAttributes(attributes);
        validSubscription.setSessionId("session");
        validSubscription.setSubscriptionId("one");
        validSubscription.setUser(new com.mindarena.service.ArenaAccessService.Identity("ABC234", "token", "player:1"));
        validSubscription.setDestination("/topic/game/ABC234");
        var valid = MessageBuilder.createMessage(new byte[0], validSubscription.getMessageHeaders());
        assertSame(valid, interceptor.preSend(valid, null));
        assertThrows(SecurityException.class, () -> interceptor.preSend(valid, null), "Inscrições duplicadas precisam ser recusadas.");
        var otherArena = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        otherArena.setSessionAttributes(new java.util.HashMap<>());
        otherArena.setSubscriptionId("other");
        otherArena.setDestination("/topic/game/XYZ234");
        otherArena.setUser(new com.mindarena.service.ArenaAccessService.Identity("ABC234", "token", "player:1"));
        assertThrows(SecurityException.class, () -> interceptor.preSend(MessageBuilder.createMessage(new byte[0], otherArena.getMessageHeaders()), null));
        var anonymous = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        anonymous.setSessionAttributes(new java.util.HashMap<>());
        anonymous.setDestination("/topic/game/ABC234");
        assertThrows(SecurityException.class, () -> interceptor.preSend(MessageBuilder.createMessage(new byte[0], anonymous.getMessageHeaders()), null));
    }
}
