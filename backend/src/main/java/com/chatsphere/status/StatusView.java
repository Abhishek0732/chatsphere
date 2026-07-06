package com.chatsphere.status;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "status_views")
@Getter
@Setter
public class StatusView {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "status_id", nullable = false)
    private Long statusId;

    @Column(name = "viewer_id", nullable = false)
    private Long viewerId;

    @CreationTimestamp
    @Column(name = "viewed_at", updatable = false)
    private Instant viewedAt;
}
