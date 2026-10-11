package com.mindarena.service;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.*;

class GuestIdentityServiceTest {

    @Test
    void whenSecretIsMissingOrBlank_serviceGeneratesEphemeralKeyAndIdentifiesGuest() {
        GuestIdentityService service = new GuestIdentityService("", false);

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        String id = service.identify(request, response);
        assertNotNull(id);
        assertFalse(id.isBlank());

        String setCookie = response.getHeader("Set-Cookie");
        assertNotNull(setCookie);
        assertTrue(setCookie.contains("arena_device="));
        assertTrue(setCookie.contains("HttpOnly"));
    }

    @Test
    void whenSecretIsShorterThan32Chars_throwsIllegalArgumentException() {
        assertThrows(IllegalArgumentException.class, () -> new GuestIdentityService("short-secret", false));
    }

    @Test
    void whenValidCookieIsProvided_reidentifiesSameGuest() {
        String secret = "abcdef0123456789abcdef0123456789"; // 32 chars
        GuestIdentityService service = new GuestIdentityService(secret, false);

        MockHttpServletRequest req1 = new MockHttpServletRequest();
        MockHttpServletResponse res1 = new MockHttpServletResponse();
        String originalId = service.identify(req1, res1);

        String cookieHeader = res1.getHeader("Set-Cookie");
        assertNotNull(cookieHeader);
        String cookieValue = cookieHeader.split(";")[0].replace("arena_device=", "");

        MockHttpServletRequest req2 = new MockHttpServletRequest();
        req2.setCookies(new Cookie("arena_device", cookieValue));
        MockHttpServletResponse res2 = new MockHttpServletResponse();

        String recognizedId = service.identify(req2, res2);
        assertEquals(originalId, recognizedId);
    }

    @Test
    void whenCookieIsTampered_rejectsAndIssuesNewIdentity() {
        String secret = "abcdef0123456789abcdef0123456789";
        GuestIdentityService service = new GuestIdentityService(secret, false);

        MockHttpServletRequest req1 = new MockHttpServletRequest();
        MockHttpServletResponse res1 = new MockHttpServletResponse();
        String originalId = service.identify(req1, res1);

        String cookieValue = res1.getHeader("Set-Cookie").split(";")[0].replace("arena_device=", "");
        String tamperedValue = cookieValue.substring(0, cookieValue.length() - 5) + "aaaaa";

        MockHttpServletRequest req2 = new MockHttpServletRequest();
        req2.setCookies(new Cookie("arena_device", tamperedValue));
        MockHttpServletResponse res2 = new MockHttpServletResponse();

        String newId = service.identify(req2, res2);
        assertNotEquals(originalId, newId);
    }
}
