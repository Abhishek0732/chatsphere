package com.chatsphere.group;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * A pending request for someone to join a group. Raised when an admin adds a
 * person who isn't one of their contacts — that person joins only once they
 * accept, so nobody can be pulled into a group by a stranger.
 */
@Entity
@Table(name = "group_invites")
@Getter
@Setter
public class GroupInvite {

    public enum Status { PENDING, ACCEPTED, DECLINED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "conversation_id", nullable = false)
    private Long conversationId;

    @Column(name = "inviter_id", nullable = false)
    private Long inviterId;

    @Column(name = "invitee_id", nullable = false)
    private Long inviteeId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Status status = Status.PENDING;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @Column(name = "responded_at")
    private Instant respondedAt;
}
