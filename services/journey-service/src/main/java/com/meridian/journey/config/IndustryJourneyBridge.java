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
    private List<Map<String, Object>> industryTransitions;

    @Value("${journey.industry.states:[]}")
    private List<Map<String, Object>> industryStates;

    @PostConstruct
    public void alignWithIndustry() {
        if (industryTransitions == null || industryTransitions.isEmpty()) {
            log.info("No industry transitions found, using defaults.");
            return;
        }

        log.info("Aligning journey lifecycle with industry config...");
        
        // 1. Build transitions map: from -> to
        Map<String, String> transMap = new HashMap<>();
        for (Map<String, Object> t : industryTransitions) {
            String from = (String) t.get("from");
            String to = (String) t.get("to");
            if (from != null && to != null) {
                transMap.put(from, to);
            }
        }
        props.setTransitions(transMap);

        // 2. Build progress map: status -> progress (approximate based on order)
        // Since the industry config doesn't explicitly define progress for every status,
        // we calculate it linearly based on the number of states.
        if (industryStates != null && !industryStates.isEmpty()) {
            Map<String, Double> progMap = new HashMap<>();
            int total = industryStates.size();
            for (int i = 0; i < total; i++) {
                Map<String, Object> s = industryStates.get(i);
                String name = (String) s.get("id") != null ? (String) s.get("id") : (String) s.get("name");
                if (name != null) {
                    progMap.put(name, (double) i / (total - 1));
                }
            }
            props.setProgressMap(progMap);
            
            // 3. Define active statuses (all except terminal)
            List<String> active = new ArrayList<>();
            for (int i = 0; i < total - 1; i++) {
                Map<String, Object> s = industryStates.get(i);
                String name = (String) s.get("id") != null ? (String) s.get("id") : (String) s.get("name");
                if (name != null) active.add(name);
            }
            props.setActiveStatuses(active);
        }
        
        log.info("Industry alignment complete. Transitions: {}, Active: {}", transMap.keySet(), props.getActiveStatuses());
    }
}
