package com.chatsphere.chat.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "conversation_members")
@Getter
@Setter
public class ConversationMember {

    public enum Role { OWNER, ADMIN, MEMBER }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "conversation_id", nullable = false)
    private Long conversationId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role = Role.MEMBER;

    @Column(name = "last_read_message_id")
    private Long lastReadMessageId;

    /**
     * Unread messages for this member, maintained on write. Counting them per
     * chat on every list load cost ~260ms for a user with 350 conversations.
     */
    @Column(name = "unread_count", nullable = false)
    private int unreadCount = 0;

    /** Per-user "delete chat" marker: messages with id <= this are hidden from this member. */
    @Column(name = "cleared_up_to_message_id")
    private Long clearedUpToMessageId;

    /**
     * Per-user "delete conversation" marker: the whole chat is hidden from this
     * member's list while the conversation's last_message_id is &lt;= this value.
     * A newer message (last_message_id climbs past it) brings the chat back.
     */
    @Column(name = "hidden_up_to_message_id")
    private Long hiddenUpToMessageId;

    @Column(name = "joined_at", insertable = false, updatable = false)
    private Instant joinedAt;
}
