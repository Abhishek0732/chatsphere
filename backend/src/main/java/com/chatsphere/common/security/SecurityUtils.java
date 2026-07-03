package com.chatsphere.common.security;

import com.chatsphere.common.error.ApiException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/** Convenience accessors for the currently authenticated principal. */
public final class SecurityUtils {

    private SecurityUtils() {}

    public static UserPrincipal currentPrincipal() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof UserPrincipal principal)) {
            throw ApiException.unauthorized("Not authenticated");
        }
        return principal;
    }

    public static Long currentUserId() {
        return currentPrincipal().id();
    }
}
