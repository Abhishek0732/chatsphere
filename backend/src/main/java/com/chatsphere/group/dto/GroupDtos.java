package com.chatsphere.group.dto;

import com.chatsphere.user.dto.UserDto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public final class GroupDtos {

    private GroupDtos() {}

    public record CreateGroupRequest(
            @NotBlank @Size(max = 150) String name,
            @NotNull List<Long> memberIds,
            String avatarUrl) {}

    public record UpdateGroupRequest(@Size(max = 150) String name, String avatarUrl) {}

    public record AddMembersRequest(@NotNull List<Long> userIds) {}

    /** A group member together with their role (OWNER / ADMIN / MEMBER). */
    public record GroupMemberDto(UserDto user, String role) {}

    public record GroupDetailDto(Long id, String name, String avatarUrl,
                                 List<GroupMemberDto> members, Long createdBy) {}

    public record UpdateMemberRoleRequest(@NotBlank String role) {}

    /**
     * Outcome of adding people to a group: contacts join straight away, while
     * anyone else is only invited and joins when they accept.
     */
    public record AddMembersResult(GroupDetailDto group,
                                   List<UserDto> added,
                                   List<UserDto> invited) {}

    /** A pending "join this group" invite, as shown to the invitee. */
    public record GroupInviteDto(Long id,
                                 Long groupId,
                                 String groupName,
                                 String groupAvatarUrl,
                                 UserDto inviter,
                                 java.time.Instant createdAt) {}
}
