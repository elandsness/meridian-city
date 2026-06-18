package com.meridian.cityops;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CityOperationsApplication {

    public static void main(String[] args) {
        SpringApplication.run(CityOperationsApplication.class, args);
    }
}
