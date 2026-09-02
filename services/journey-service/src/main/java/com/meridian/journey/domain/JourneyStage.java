package com.meridian.journey.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Journey stage — represents a specific point in a journey (e.g., "at_gate", "boarding",
 * "checked_in", "security_cleared"). Configurable per industry.
 */
@Entity
@Table(schema = "journey", name = "journey_stages")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JourneyStage {

    @Id
    private String id;

    @Column(name = "journey_id")
    private String journeyId;

    /** Stage name (e.g., "at_gate", "boarding", "checked_in"). */
    private String stageName;

    /** Stage order (for sorting). */
    @Column(name = "stage_order")
    private int stageOrder;

    /** Stage progress (0..1). */
    private double progress;

    @Column(name = "entered_at")
    private OffsetDateTime enteredAt;

    @Column(name = "exited_at")
    private OffsetDateTime exitedAt;

    /** Factory — generates id like "js-a1b2c". */
    public static JourneyStage create(String journeyId, String stageName, int stageOrder, double progress) {
        String shortId = UUID.randomUUID().toString().replace("-", "").substring(0, 5);
        return JourneyStage.builder()
                .id("js-" + shortId)
                .journeyId(journeyId)
                .stageName(stageName)
                .stageOrder(stageOrder)
                .progress(progress)
                .enteredAt(OffsetDateTime.now())
                .build();
    }
}
