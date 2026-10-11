package com.mindarena.config;

import com.mindarena.service.ArenaActivityMonitor;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.regex.Pattern;

@Component
@Order(0)
public class ArenaActivityFilter extends OncePerRequestFilter {
    private static final Pattern ROOM = Pattern.compile("(?i)^/api/games/([A-Z0-9]{6})(?:/|$)");
    private final ArenaActivityMonitor monitor;
    public ArenaActivityFilter(ArenaActivityMonitor monitor) { this.monitor = monitor; }

    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                               FilterChain chain) throws ServletException, IOException {
        var room = ROOM.matcher(request.getRequestURI());
        if (request.getMethod().equals("OPTIONS") || request.getRequestURI().endsWith("/diagnostics") || !room.find()) {
            chain.doFilter(request, response);
            return;
        }
        boolean completed = false;
        try { chain.doFilter(request, response); completed = true; }
        finally { monitor.recordRequest(room.group(1), completed ? response.getStatus() : 500); }
    }
}
