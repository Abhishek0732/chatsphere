package com.chatsphere.user.dto;

/**
 * The short code behind my shareable "add me" link. The client builds the URL
 * (/i/<code>) from its own origin, so the same code works on localhost, a LAN
 * IP, or a public tunnel.
 */
public record InviteDto(String code) {}
