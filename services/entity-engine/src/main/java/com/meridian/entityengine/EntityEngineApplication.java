package com.meridian.entityengine;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class EntityEngineApplication {
    public static void main(String[] args) {
        SpringApplication.run(EntityEngineApplication.class, args);
    }
}
