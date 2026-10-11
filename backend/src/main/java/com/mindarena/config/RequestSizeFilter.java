package com.mindarena.config;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.*;

@Component
@Order(2)
public class RequestSizeFilter extends OncePerRequestFilter {
    private static final int MAX = 512 * 1024;
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        if (request.getContentLengthLong() > MAX) {
            response.setStatus(413); response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"message\":\"Conteúdo muito grande. O limite é 512 KB por envio.\"}");
            return;
        }
        chain.doFilter(new HttpServletRequestWrapper(request) {
            private ServletInputStream limited;
            @Override public ServletInputStream getInputStream() throws IOException {
                if (limited == null) {
                    ServletInputStream source = super.getInputStream();
                    limited = new ServletInputStream() {
                        int count;
                        private void check(int read) throws IOException {
                            if (read > 0 && (count += read) > MAX) throw new IOException("Limite do corpo da requisição excedido.");
                        }
                        @Override public int read() throws IOException { int result = source.read(); if (result >= 0) check(1); return result; }
                        @Override public int read(byte[] bytes, int offset, int length) throws IOException { int result = source.read(bytes, offset, Math.min(length, MAX - count + 1)); check(result); return result; }
                        @Override public boolean isFinished() { return source.isFinished(); }
                        @Override public boolean isReady() { return source.isReady(); }
                        @Override public void setReadListener(ReadListener listener) { source.setReadListener(listener); }
                    };
                }
                return limited;
            }
            @Override public BufferedReader getReader() throws IOException { return new BufferedReader(new InputStreamReader(getInputStream(), java.nio.charset.StandardCharsets.UTF_8)); }
        }, response);
    }
}
