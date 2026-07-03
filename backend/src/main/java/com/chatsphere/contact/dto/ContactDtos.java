package com.chatsphere.contact.dto;

import com.chatsphere.user.dto.UserDto;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public final class ContactDtos {

    private ContactDtos() {}

    public record ContactDto(Long id, UserDto user, String alias, Instant createdAt) {}

    public record AddContactRequest(@NotNull Long contactUserId, String alias) {}

    /** A pending/decided contact invitation. `user` is the other party (sender for
     *  incoming, recipient for outgoing). */
    public record ContactRequestDto(Long id, UserDto user, String direction,
                                    String status, Instant createdAt) {}

    /** Result of sending an invitation: PENDING (new invite) or ACCEPTED (auto-accepted). */
    public record SendRequestResult(String status) {}
}
