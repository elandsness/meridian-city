package com.meridian.journey.dto;

import java.time.OffsetDateTime;

public class JourneyStage {
    private String stageName;
    private int stageOrder;
    private double progress;
    private OffsetDateTime enteredAt;
    private OffsetDateTime exitedAt;

    public JourneyStage() {}
    public JourneyStage(String stageName, int stageOrder, double progress, OffsetDateTime enteredAt, OffsetDateTime exitedAt) {
        this.stageName = stageName;
        this.stageOrder = stageOrder;
        this.progress = progress;
        this.enteredAt = enteredAt;
        this.exitedAt = exitedAt;
    }

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
}
