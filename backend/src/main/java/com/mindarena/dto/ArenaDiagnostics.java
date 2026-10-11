package com.mindarena.dto;

// Explicit allowlist: never serialize entities, runtime beans or audit records here.
public record ArenaDiagnostics(Health health, Activity activity, Admission admission) {
    public enum Level { NORMAL, ATTENTION, UNAVAILABLE }
    public record Health(Level overall, Level memory, Level processing, Level connections) {}
    public record Activity(long requestsLastMinute, long limitedRequestsLastMinute,
                           long failedRequestsLastMinute, long newPlayersLastMinute, int connectedSessions) {}
    public record Admission(long activePlayers, boolean joinLocked, boolean canChangeEntries) {}
}
