package com.chatsphere.auth;

import com.chatsphere.auth.dto.AuthDtos.*;
import com.chatsphere.common.config.AppProperties;
import com.chatsphere.common.error.ApiException;
import com.chatsphere.common.security.JwtService;
import com.chatsphere.user.User;
import com.chatsphere.user.UserRepository;
import com.chatsphere.user.dto.UserDto;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final long refreshTtlDays;

    public AuthService(UserRepository userRepository,
                       RefreshTokenRepository refreshTokenRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       AuthenticationManager authenticationManager,
                       AppProperties props) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
        this.refreshTtlDays = props.jwt().refreshTtlDays();
    }

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        if (userRepository.existsByUsername(req.username())) {
            throw ApiException.conflict("Username already taken");
        }
        if (userRepository.existsByEmail(req.email())) {
            throw ApiException.conflict("Email already registered");
        }
        User user = new User();
        user.setUsername(req.username());
        user.setEmail(req.email());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setDisplayName(req.displayName());
        user.setRole("USER");
        user = userRepository.save(user);

        return issueTokens(user);
    }

    @Transactional
    public AuthResponse login(LoginRequest req) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(req.usernameOrEmail(), req.password()));
        User user = userRepository.findByUsernameOrEmail(req.usernameOrEmail(), req.usernameOrEmail())
                .orElseThrow(() -> ApiException.unauthorized("Invalid credentials"));
        return issueTokens(user);
    }

    @Transactional
    public TokenPair refresh(RefreshRequest req) {
        RefreshToken stored = refreshTokenRepository.findByToken(req.refreshToken())
                .orElseThrow(() -> ApiException.unauthorized("Invalid refresh token"));
        if (stored.isRevoked() || stored.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.unauthorized("Refresh token expired");
        }
        User user = userRepository.findById(stored.getUserId())
                .orElseThrow(() -> ApiException.unauthorized("User no longer exists"));

        // rotate: revoke old, issue new
        stored.setRevoked(true);
        refreshTokenRepository.save(stored);
        String access = jwtService.generateAccessToken(user.getId(), user.getUsername(), user.getRole());
        String refresh = createRefreshToken(user.getId());
        return new TokenPair(access, refresh);
    }

    @Transactional
    public void logout(LogoutRequest req) {
        refreshTokenRepository.findByToken(req.refreshToken()).ifPresent(t -> {
            t.setRevoked(true);
            refreshTokenRepository.save(t);
        });
    }

    private AuthResponse issueTokens(User user) {
        String access = jwtService.generateAccessToken(user.getId(), user.getUsername(), user.getRole());
        String refresh = createRefreshToken(user.getId());
        return new AuthResponse(access, refresh, UserDto.from(user));
    }

    private String createRefreshToken(Long userId) {
        RefreshToken rt = new RefreshToken();
        rt.setUserId(userId);
        rt.setToken(UUID.randomUUID() + "." + UUID.randomUUID());
        rt.setExpiresAt(Instant.now().plus(refreshTtlDays, ChronoUnit.DAYS));
        rt.setRevoked(false);
        refreshTokenRepository.save(rt);
        return rt.getToken();
    }
}
