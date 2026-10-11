package com.mindarena.service;

import com.mindarena.dto.ArenaDiagnostics;
import com.mindarena.dto.ArenaDiagnostics.Level;
import org.springframework.stereotype.Service;
import java.lang.management.ManagementFactory;

@Service
public class ArenaDiagnosticsService {
    private final ArenaActivityMonitor activity;
    private final ArenaSocketSessions sockets;
    private long nextSample;
    private Level memory = Level.UNAVAILABLE, processing = Level.UNAVAILABLE;

    public ArenaDiagnosticsService(ArenaActivityMonitor activity, ArenaSocketSessions sockets) {
        this.activity = activity; this.sockets = sockets;
    }
    private synchronized void sampleHealth() {
        long now = System.currentTimeMillis();
        if (now < nextSample) return;
        nextSample = now + 5000;
        try {
            var heap = ManagementFactory.getMemoryMXBean().getHeapMemoryUsage();
            memory = heap.getMax() > 0 ? level((double) heap.getUsed() / heap.getMax()) : Level.UNAVAILABLE;
        } catch (RuntimeException ex) { memory = Level.UNAVAILABLE; }
        try {
            var operatingSystem = ManagementFactory.getOperatingSystemMXBean();
            processing = operatingSystem instanceof com.sun.management.OperatingSystemMXBean process
                ? level(process.getProcessCpuLoad()) : Level.UNAVAILABLE;
        } catch (RuntimeException ex) { processing = Level.UNAVAILABLE; }
    }
    private static Level level(double usage) {
        if (!Double.isFinite(usage) || usage < 0) return Level.UNAVAILABLE;
        return usage >= 0.85 ? Level.ATTENTION : Level.NORMAL;
    }
    public synchronized ArenaDiagnostics snapshot(String code, long activePlayers, boolean joinLocked, boolean canChangeEntries) {
        sampleHealth();
        Level connections = sockets.underPressure() ? Level.ATTENTION : Level.NORMAL;
        Level overall = memory == Level.ATTENTION || processing == Level.ATTENTION || connections == Level.ATTENTION
            ? Level.ATTENTION : memory == Level.UNAVAILABLE || processing == Level.UNAVAILABLE ? Level.UNAVAILABLE : Level.NORMAL;
        var recent = activity.snapshot(code);
        return new ArenaDiagnostics(new ArenaDiagnostics.Health(overall, memory, processing, connections),
            new ArenaDiagnostics.Activity(recent.requests(), recent.limited(), recent.failed(), recent.arrivals(), sockets.countForArena(code)),
            new ArenaDiagnostics.Admission(activePlayers, joinLocked, canChangeEntries));
    }
}
