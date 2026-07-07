package com.chatsphere.status;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** Per-user rule for who may see that user's statuses. */
@Entity
@Table(name = "status_privacy")
@Getter
@Setter
public class StatusPrivacy {

    /** Who may see the owner's statuses. */
    public enum Mode { ALL, EXCEPT, ONLY }

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Mode mode = Mode.ALL;
}
