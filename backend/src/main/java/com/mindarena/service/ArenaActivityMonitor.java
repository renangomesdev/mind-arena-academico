package com.mindarena.service;

import org.springframework.stereotype.Component;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.function.LongSupplier;

@Component
public class ArenaActivityMonitor {
    private static final int MAX_ARENAS = 512;
    private static final int BUCKETS = 60;
    private final LongSupplier clock;
    // Only room codes and aggregate counters; no headers, addresses or participant identifiers.
    private final LinkedHashMap<String, Window> rooms = new LinkedHashMap<>(16, 0.75f, true);

    public record Snapshot(long requests, long limited, long failed, long arrivals) {}
    private static class Window {
        final long[] seconds = new long[BUCKETS];
        final long[][] counts = new long[BUCKETS][4];
        long lastSeen;
        void add(long second, int kind) {
            int slot = (int) Math.floorMod(second, BUCKETS);
            if (seconds[slot] != second) {
                seconds[slot] = second;
                java.util.Arrays.fill(counts[slot], 0);
            }
            counts[slot][kind]++;
            lastSeen = second;
        }
        Snapshot snapshot(long now) {
            long[] totals = new long[4];
            for (int i = 0; i < BUCKETS; i++) {
                if (seconds[i] > now - BUCKETS && seconds[i] <= now) {
                    for (int j = 0; j < totals.length; j++) totals[j] += counts[i][j];
                }
            }
            return new Snapshot(totals[0], totals[1], totals[2], totals[3]);
        }
    }

    public ArenaActivityMonitor() { this(System::currentTimeMillis); }
    ArenaActivityMonitor(LongSupplier clock) { this.clock = clock; }

    private String normalize(String code) {
        return code != null && code.matches("(?i)[A-Z0-9]{6}") ? code.toUpperCase(Locale.ROOT) : null;
    }
    private Window window(String code, long now) {
        // Cleanup only on new room allocation, bounded to at most MAX_ARENAS entries.
        Window existing = rooms.get(code);
        if (existing != null) return existing;
        rooms.values().removeIf(value -> value.lastSeen <= now - BUCKETS);
        if (rooms.size() >= MAX_ARENAS) rooms.remove(rooms.keySet().iterator().next());
        Window created = new Window();
        rooms.put(code, created);
        return created;
    }
    public synchronized void recordRequest(String code, int status) {
        String normalized = normalize(code);
        if (normalized == null) return;
        long now = clock.getAsLong() / 1000;
        Window window = window(normalized, now);
        window.add(now, 0);
        if (status == 429) window.add(now, 1);
        if (status >= 500) window.add(now, 2);
    }
    public synchronized void recordArrival(String code) {
        String normalized = normalize(code);
        long now = clock.getAsLong() / 1000;
        if (normalized != null) window(normalized, now).add(now, 3);
    }
    public synchronized Snapshot snapshot(String code) {
        Window window = rooms.get(normalize(code));
        return window == null ? new Snapshot(0, 0, 0, 0) : window.snapshot(clock.getAsLong() / 1000);
    }
    synchronized int trackedRooms() { return rooms.size(); }
}
