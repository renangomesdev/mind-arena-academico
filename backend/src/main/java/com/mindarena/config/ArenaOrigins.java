package com.mindarena.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.Arrays;

@Component
public class ArenaOrigins {
    private final String[] origins;

    public ArenaOrigins(@Value("${arena.allowed-origins:http://localhost:5173,http://127.0.0.1:5173}") String configured) {
        origins = Arrays.stream(configured.split(",", -1)).map(String::trim)
            .map(ArenaOrigins::validate).distinct().toArray(String[]::new);
    }

    private static String validate(String value) {
        try {
            URI origin = URI.create(value);
            boolean http = "http".equalsIgnoreCase(origin.getScheme()) || "https".equalsIgnoreCase(origin.getScheme());
            if (!http || origin.getHost() == null || value.contains("*") || origin.getRawUserInfo() != null ||
                origin.getRawQuery() != null || origin.getRawFragment() != null ||
                !(origin.getRawPath().isEmpty() || origin.getRawPath().equals("/")) ||
                origin.getPort() == 0 || origin.getPort() > 65535) {
                throw new IllegalArgumentException();
            }
            return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("ALLOWED_ORIGINS deve conter origens HTTP/HTTPS completas, separadas por vírgula, sem curingas ou caminhos.");
        }
    }

    public String[] values() { return origins.clone(); }
}
