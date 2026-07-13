package com.chatsphere.user.dto;

import jakarta.validation.constraints.NotBlank;

/** Deleting an account is irreversible, so the password must be re-entered. */
public record DeleteAccountRequest(@NotBlank String password) {}
