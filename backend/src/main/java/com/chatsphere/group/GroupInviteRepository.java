package com.chatsphere.group;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GroupInviteRepository extends JpaRepository<GroupInvite, Long> {

    List<GroupInvite> findByInviteeIdAndStatusOrderByIdDesc(Long inviteeId, GroupInvite.Status status);

    Optional<GroupInvite> findByConversationIdAndInviteeId(Long conversationId, Long inviteeId);

    boolean existsByConversationIdAndInviteeIdAndStatus(Long conversationId, Long inviteeId,
                                                        GroupInvite.Status status);
}
