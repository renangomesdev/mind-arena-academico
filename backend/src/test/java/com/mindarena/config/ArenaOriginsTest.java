package com.mindarena.config;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ArenaOriginsTest {
    @Test void acceptsExplicitOriginsAndNormalizesTrailingSlash() {
        var origins = new ArenaOrigins(" https://arena.example.org/, http://localhost:5173,https://arena.example.org ");
        assertArrayEquals(new String[] {"https://arena.example.org", "http://localhost:5173"}, origins.values());
    }

    @Test void rejectsBroadPermissionsAndValuesThatAreNotOrigins() {
        for (String value : new String[] {"*", "https://*.example.org", "", "https://arena.example.org,",
            "null", "file:///tmp", "https://user:password@arena.example.org", "https://arena.example.org/path",
            "https://arena.example.org?query=1", "https://arena.example.org#fragment", "http://localhost:99999"}) {
            assertThrows(IllegalArgumentException.class, () -> new ArenaOrigins(value), value);
        }
    }

    @Test void callersCannotMutateTheConfiguredPermissions() {
        var origins = new ArenaOrigins("https://arena.example.org");
        origins.values()[0] = "*";
        assertEquals("https://arena.example.org", origins.values()[0]);
    }
}
