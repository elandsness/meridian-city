package com.meridian.cityops.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Entity
@Table(schema = "incidents", name = "incident_comments")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IncidentComment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "incident_id", length = 50, nullable = false)
    private String incidentId;

    @Column(length = 100)
    private String author;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String body;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;
}
