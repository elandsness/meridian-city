package com.meridian.journey.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.*;

@Configuration
@RequiredArgsConstructor
@Slf4j
public class IndustryJourneyBridge {

    private final JourneyLifecycleProperties props;

    // We expect a JSON structure passed via SPRING_APPLICATION_JSON from Helm
    // that matches the industry.entities.<type>.states and transitions.
    
    @Value("${journey.industry.transitions:[]}")
    private String industryTransitionsRaw;

    @Value("${journey.industry.states:[]}")
    private String industryStatesRaw;

    @PostConstruct
    public void alignWithIndustry() {
        List<Map<String, Object>> transitions = parseJsonList(industryTransitionsRaw);
        List<Map<String, Object>> states = parseJsonList(industryStatesRaw);

        if (transitions == null || transitions.isEmpty()) {
            log.info("No industry transitions found, using defaults.");
            return;
        }

        log.info("Aligning journey lifecycle with industry config...");
        
        Map<String, String> transMap = new HashMap<>();
        for (Map<String, Object> t : transitions) {
            String from = (String) t.get("from");
            String to = (String) t.get("to");
            if (from != null && to != null) {
                transMap.put(from, to);
            }
        }
        props.setTransitions(transMap);

        if (states != null && !states.isEmpty()) {
            Map<String, Double> progMap = new HashMap<>();
            int total = states.size();
            for (int i = 0; i < total; i++) {
                Map<String, Object> s = states.get(i);
                String name = (String) s.get("id") != null ? (String) s.get("id") : (String) s.get("name");
                if (name != null) {
                    progMap.put(name, (double) i / (total - 1));
                }
            }
            props.setProgressMap(progMap);
            
            List<String> active = new ArrayList<>();
            for (int i = 0; i < total - 1; i++) {
                Map<String, Object> s = states.get(i);
                String name = (String) s.get("id") != null ? (String) s.get("id") : (String) s.get("name");
                if (name != null) active.add(name);
            }
            props.setActiveStatuses(active);
        }
        
        log.info("Industry alignment complete. Transitions: {}, Active: {}", transMap.keySet(), props.getActiveStatuses());
    }

    private List<Map<String, Object>> parseJsonList(String json) {
        if (json == null || json.equals("[]") || json.trim().isEmpty()) {
            return Collections.emptyList();
        }
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper()
                .readValue(json, new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            log.warn("Failed to parse industry JSON: {}", e.getMessage());
            return Collections.emptyList();
        }
    }
}
