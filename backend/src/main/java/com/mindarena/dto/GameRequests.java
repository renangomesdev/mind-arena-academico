package com.mindarena.dto;

import jakarta.validation.constraints.*;

public final class GameRequests {
    private GameRequests() {}

    public record Create(boolean powersEnabled) {}
    public record Join(@NotBlank @Size(max = 30) String nickname, @Size(max = 30) String avatar) {}
    public record Advance(@NotNull @Min(0) Integer questionIndex) {}
    public record Answer(@NotNull @Positive Long playerId, @NotNull @Positive Long questionId,
                         @NotNull @Positive Long optionId, @NotNull @Min(0) Integer timeTakenMs) {}
    public record Toggle(@NotNull Boolean enable) {}
    public record Blind(@NotNull @Positive Long attackerId, @NotNull @Positive Long targetId, @NotNull @Positive Long questionId) {}
    public record Hint(@NotNull @Positive Long playerId, @NotNull @Positive Long questionId) {}
}
