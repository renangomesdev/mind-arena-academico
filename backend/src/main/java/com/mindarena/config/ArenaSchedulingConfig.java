package com.mindarena.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

@Configuration
public class ArenaSchedulingConfig {
    @Bean(name = "taskScheduler")
    public ThreadPoolTaskScheduler arenaTaskScheduler() {
        var scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(3);
        scheduler.setThreadNamePrefix("arena-clock-");
        return scheduler;
    }
}
