package com.meridian.citizen;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CitizenServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(CitizenServiceApplication.class, args);
    }
}
