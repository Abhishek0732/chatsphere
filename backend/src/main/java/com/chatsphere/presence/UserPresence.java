package com.chatsphere.presence;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "user_presence")
@Getter
@Setter
public class UserPresence {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false)
    private boolean online;

    @Column(name = "last_seen")
    private Instant lastSeen;
}
