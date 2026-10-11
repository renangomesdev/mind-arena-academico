package com.mindarena.config;

import com.mindarena.service.ArenaAccessService;
import com.mindarena.service.ArenaSocketSessions;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.messaging.simp.config.*;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.messaging.support.*;
import org.springframework.messaging.*;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;
import org.springframework.web.socket.config.annotation.*;
import java.util.Map;
import java.util.HashSet;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    private final ArenaAccessService access;
    private final ArenaSocketSessions sessions;
    private final ArenaOrigins origins;
    public WebSocketConfig(ArenaAccessService access, ArenaSocketSessions sessions, ArenaOrigins origins) {
        this.access = access; this.sessions = sessions; this.origins = origins;
    }
    @Bean
    public ThreadPoolTaskScheduler arenaBrokerScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(2);
        scheduler.setThreadNamePrefix("arena-heartbeat-");
        return scheduler;
    }
    @Override public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        registration.setMessageSizeLimit(16 * 1024).setSendBufferSizeLimit(64 * 1024).setSendTimeLimit(10000).setTimeToFirstMessage(10000);
        registration.addDecoratorFactory(handler -> new WebSocketHandlerDecorator(handler) {
            @Override public void afterConnectionEstablished(WebSocketSession session) throws Exception {
                if (!sessions.add(session)) { session.close(CloseStatus.POLICY_VIOLATION); return; }
                try { super.afterConnectionEstablished(session); }
                catch (Exception ex) { sessions.remove(session.getId()); throw ex; }
            }
            @Override public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
                sessions.remove(session.getId());
                super.afterConnectionClosed(session, status);
            }
        });
    }
    private static class Traffic {
        long start = System.currentTimeMillis();
        int count;
        final HashSet<String> subscriptions = new HashSet<>();
    }
    @Override public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.taskExecutor().corePoolSize(2).maxPoolSize(8).queueCapacity(512);
        registration.interceptors(new ChannelInterceptor() {
            @Override public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor header = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (header == null || header.getCommand() == StompCommand.DISCONNECT) return message;
                Map<String, Object> attributes = header.getSessionAttributes();
                if (attributes == null) throw new SecurityException("Conexão inválida.");
                Traffic traffic;
                synchronized (attributes) { traffic = (Traffic) attributes.computeIfAbsent("arenaTraffic", key -> new Traffic()); }
                synchronized (traffic) {
                    long now = System.currentTimeMillis();
                    if (now - traffic.start > 5000) { traffic.start = now; traffic.count = 0; }
                    if (++traffic.count > 30) throw new SecurityException("Limite de mensagens atingido.");
                    if (header.getCommand() == StompCommand.CONNECT) {
                        var identity = access.authenticate(header.getFirstNativeHeader("arenaCode"), header.getFirstNativeHeader("hostToken"),
                            header.getFirstNativeHeader("playerId"), header.getFirstNativeHeader("playerToken"));
                        sessions.bind(header.getSessionId(), identity.token(), identity.code());
                        header.setUser(identity);
                        return message;
                    }
                    if (!(header.getUser() instanceof ArenaAccessService.Identity identity)) throw new SecurityException("Autenticação necessária.");
                    if (header.getCommand() == null) return message;
                    if (header.getCommand() == StompCommand.SUBSCRIBE) {
                        if (!("/topic/game/" + identity.code()).equals(header.getDestination()) || header.getSubscriptionId() == null ||
                                !traffic.subscriptions.isEmpty()) throw new SecurityException("Apenas uma inscrição na sua arena é permitida.");
                        traffic.subscriptions.add(header.getSubscriptionId());
                    } else if (header.getCommand() == StompCommand.UNSUBSCRIBE) {
                        traffic.subscriptions.remove(header.getSubscriptionId());
                    } else {
                        throw new SecurityException("Comando de publicação não permitido.");
                    }
                }
                return message;
            }
        });
    }
    @Override public void configureClientOutboundChannel(ChannelRegistration registration) {
        registration.taskExecutor().corePoolSize(2).maxPoolSize(8).queueCapacity(1024);
    }
    @Override public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws").setAllowedOrigins(origins.values());
    }
    @Override public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.setApplicationDestinationPrefixes("/app");
        registry.setPreservePublishOrder(true);
        registry.enableSimpleBroker("/topic").setHeartbeatValue(new long[] {10000, 10000}).setTaskScheduler(arenaBrokerScheduler());
    }
}
