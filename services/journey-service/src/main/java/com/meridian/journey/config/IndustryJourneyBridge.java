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
    
    @Value("${journey.industry.entities:{}}")
    private String industryEntitiesRaw;

    @PostConstruct
    public void alignWithIndustry() {
        Map<String, Object> entities = parseJsonMap(industryEntitiesRaw);

        if (entities == null || entities.isEmpty()) {
            log.info("No industry entities found, using defaults.");
            return;
        }

        log.info("Aligning journey lifecycle with industry config...");
        
        Map<String, String> transMap = new HashMap<>();
        List<Map<String, Object>> allStates = new ArrayList<>();
        
        for (Map.Entry<String, Object> entry : entities.entrySet()) {
            Map<String, Object> entityCfg = (Map<String, Object>) entry.getValue();
            
            List<Map<String, Object>> transitions = (List<Map<String, Object>>) entityCfg.get("transitions");
            if (transitions != null) {
                for (Map<String, Object> t : transitions) {
                    String from = (String) t.get("from");
                    String to = (String) t.get("to");
                    if (from != null && to != null) {
                        transMap.put(from, to);
                    }
                }
            }

        Map<String, Object> states = (Map<String, Object>) entityCfg.get("states");
        if (states != null) {
            // Use sequence if available for ordering, otherwise use map keys
            List<String> sequence = (List<String>) entityCfg.get("sequence");
            if (sequence != null) {
                for (String stateId : sequence) {
                    Map<String, Object> s = (Map<String, Object>) states.get(stateId);
                    if (s != null) {
                        allStates.add(s);
                        // Store the ID in the state map itself so the progress loop can find it
                        s.put("__id", stateId);
                    }
                }
            } else {
                for (Map.Entry<String, Object> stateEntry : states.entrySet()) {
                    Map<String, Object> s = (Map<String, Object>) stateEntry.getValue();
                    if (s != null) {
                        s.put("__id", stateEntry.getKey());
                        allStates.add(s);
                    }
                }
            }
        }
        }
        props.setTransitions(transMap);

        if (!allStates.isEmpty()) {
            Map<String, Double> progMap = new HashMap<>();
            int total = allStates.size();
            for (int i = 0; i < total; i++) {
                Map<String, Object> s = allStates.get(i);
                String name = (String) s.get("__id") != null ? (String) s.get("__id") : (String) s.get("id") != null ? (String) s.get("id") : (String) s.get("name");
                if (name != null) {
                    progMap.put(name, (double) i / (total - 1));
                }
            }
            props.setProgressMap(progMap);
            
            List<String> active = new ArrayList<>();
            for (int i = 0; i < total - 1; i++) {
                Map<String, Object> s = allStates.get(i);
                String name = (String) s.get("id") != null ? (String) s.get("id") : (String) s.get("name");
                if (name != null) active.add(name);
            }
            props.setActiveStatuses(active);
        }
        
        log.info("Industry alignment complete. Transitions: {}, Active: {}", transMap.keySet(), props.getActiveStatuses());
    }

    private Map<String, Object> parseJsonMap(String json) {
        if (json == null || json.equals("{}") || json.trim().isEmpty()) {
            return Collections.emptyMap();
        }
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper()
                .readValue(json, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.warn("Failed to parse industry JSON map: {}", e.getMessage());
            return Collections.emptyMap();
        }
    }
}
