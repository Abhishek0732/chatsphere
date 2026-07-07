package com.chatsphere.status;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** A single user chosen in an owner's status-privacy list (meaning depends on
 *  the owner's mode: excluded when EXCEPT, allowed when ONLY). */
@Entity
@Table(name = "status_privacy_users")
@Getter
@Setter
public class StatusPrivacyUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(name = "target_user_id", nullable = false)
    private Long targetUserId;
}
