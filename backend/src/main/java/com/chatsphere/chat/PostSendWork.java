package com.chatsphere.chat;

import com.chatsphere.chat.repo.ConversationMemberRepository;
import com.chatsphere.chat.repo.ConversationRepository;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The bookkeeping that follows a message, done AFTER it has been committed and
 * delivered — never in front of it.
 *
 * Both of these used to sit inside the send transaction:
 *   - advancing the conversation's last-message pointer (an UPDATE on a row every
 *     other sender in that chat also needs), and
 *   - bumping the unread badge, which touches one row PER MEMBER — 500 of them in
 *     a large group.
 * That made every sender queue behind every other sender, and paid the
 * commit/fsync cost several times per message. Neither is needed for the message
 * to reach anyone, so they happen here instead: the badge and the chat-list order
 * land milliseconds later, and the send path is a single INSERT.
 */
@Component
public class PostSendWork {

    private final ConversationRepository conversationRepository;
    private final ConversationMemberRepository memberRepository;

    public PostSendWork(ConversationRepository conversationRepository,
                        ConversationMemberRepository memberRepository) {
        this.conversationRepository = conversationRepository;
        this.memberRepository = memberRepository;
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void finish(Long conversationId, Long senderId, Long messageId) {
        // GREATEST: two messages committing at once must not move the pointer back.
        conversationRepository.advanceLastMessage(conversationId, messageId);
        memberRepository.incrementUnread(conversationId, senderId);
    }
}
