package com.mindarena.service;

import org.junit.jupiter.api.Test;
import java.util.concurrent.atomic.AtomicLong;
import static org.junit.jupiter.api.Assertions.*;

class ArenaActivityMonitorTest {
    @Test
    void keepsOnlyLastMinuteAndSeparatesRooms() {
        var now = new AtomicLong(120000);
        var monitor = new ArenaActivityMonitor(now::get);
        monitor.recordRequest("ABC234", 200);
        monitor.recordRequest("abc234", 429);
        monitor.recordRequest("ABC234", 500);
        monitor.recordRequest("ABC234", 403);
        monitor.recordArrival("ABC234");
        monitor.recordRequest("XYZ234", 429);
        assertEquals(new ArenaActivityMonitor.Snapshot(4, 1, 1, 1), monitor.snapshot("ABC234"));
        assertEquals(new ArenaActivityMonitor.Snapshot(1, 1, 0, 0), monitor.snapshot("XYZ234"));
        now.addAndGet(59000);
        monitor.recordRequest("ABC234", 200);
        now.addAndGet(1000);
        assertEquals(new ArenaActivityMonitor.Snapshot(1, 0, 0, 0), monitor.snapshot("ABC234"));
        assertEquals(new ArenaActivityMonitor.Snapshot(0, 0, 0, 0), monitor.snapshot("XYZ234"));
        now.addAndGet(60000);
        assertEquals(new ArenaActivityMonitor.Snapshot(0, 0, 0, 0), monitor.snapshot("ABC234"));
    }

    @Test
    void arbitraryRoomProbesCannotGrowMemoryWithoutLimit() {
        var now = new AtomicLong(120000);
        var monitor = new ArenaActivityMonitor(now::get);
        for (int i = 0; i < 600; i++) monitor.recordRequest(String.format("%06d", i), 403);
        assertEquals(512, monitor.trackedRooms());
        assertEquals(0, monitor.snapshot("000000").requests());
        assertEquals(1, monitor.snapshot("000599").requests());
        now.addAndGet(61000);
        monitor.recordRequest("ABC234", 200);
        assertEquals(1, monitor.trackedRooms());
    }

    @Test
    void onlyRoomCodesCanBeStored() {
        var monitor = new ArenaActivityMonitor(() -> 120000);
        monitor.recordRequest("127.0.0.1", 200);
        monitor.recordRequest("nickname", 200);
        monitor.recordArrival(null);
        assertEquals(0, monitor.trackedRooms());
        assertEquals(0, monitor.snapshot(null).requests());
    }
}
