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

    public record GroupDetailDto(Long id, String name, String avatarUrl,
                                 List<UserDto> members, Long createdBy) {}
}
