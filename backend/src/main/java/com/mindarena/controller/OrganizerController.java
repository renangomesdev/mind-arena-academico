package com.mindarena.controller;

import com.mindarena.service.OrganizerService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/organizer")
public class OrganizerController {
    private final OrganizerService organizers;
    public OrganizerController(OrganizerService organizers) { this.organizers = organizers; }
    public record Login(@NotBlank @Size(max = 128) String password) {}
    @PostMapping("/login")
    public Map<String, Object> login(@Valid @RequestBody Login request) { return organizers.login(request.password()); }
    @PostMapping("/logout")
    public void logout(@RequestHeader(value = "X-Organizer-Token", required = false) String token) { organizers.logout(token); }
}

