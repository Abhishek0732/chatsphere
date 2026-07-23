package com.chatsphere.chat.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.util.Objects;

/**
 * One row = "this user has deleted this message for themselves". The message is
 * still there for everyone else; read paths just filter these out for the viewer.
 * Composite (user_id, message_id) primary key — no surrogate id, so the key IS
 * the uniqueness guarantee and the lookup index.
 */
@Entity
@Table(name = "hidden_messages")
@IdClass(HiddenMessage.Key.class)
@Getter
@Setter
public class HiddenMessage {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Id
    @Column(name = "message_id")
    private Long messageId;

    public static class Key implements Serializable {
        private Long userId;
        private Long messageId;

        public Key() {}

        public Key(Long userId, Long messageId) {
            this.userId = userId;
            this.messageId = messageId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof Key key)) return false;
            return Objects.equals(userId, key.userId) && Objects.equals(messageId, key.messageId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(userId, messageId);
        }
    }
}
