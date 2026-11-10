package com.meridian.journey.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(schema = "journey", name = "journey_stages")
public class JourneyStage {

    @Id
    private String id;

    @Column(name = "journey_id")
    private String journeyId;

    private String stageName;

    @Column(name = "stage_order")
    private int stageOrder;

    private double progress;

    @Column(name = "entered_at")
    private OffsetDateTime enteredAt;

    @Column(name = "exited_at")
    private OffsetDateTime exitedAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getJourneyId() { return journeyId; }
    public void setJourneyId(String journeyId) { this.journeyId = journeyId; }

    public String getStageName() { return stageName; }
    public void setStageName(String stageName) { this.stageName = stageName; }

    public int getStageOrder() { return stageOrder; }
    public void setStageOrder(int stageOrder) { this.stageOrder = stageOrder; }

    public double getProgress() { return progress; }
    public void setProgress(double progress) { this.progress = progress; }

    public OffsetDateTime getEnteredAt() { return enteredAt; }
    public void setEnteredAt(OffsetDateTime enteredAt) { this.enteredAt = enteredAt; }

    public OffsetDateTime getExitedAt() { return exitedAt; }
    public void setExitedAt(OffsetDateTime exitedAt) { this.exitedAt = exitedAt; }

    public static JourneyStage create(String journeyId, String stageName, int stageOrder, double progress) {
        JourneyStage stage = new JourneyStage();
        String shortId = UUID.randomUUID().toString().replace("-", "").substring(0, 5);
        stage.setId("js-" + shortId);
        stage.setJourneyId(journeyId);
        stage.setStageName(stageName);
        stage.setStageOrder(stageOrder);
        stage.setProgress(progress);
        stage.setEnteredAt(OffsetDateTime.now());
        return stage;
    }
}
