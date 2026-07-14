package com.chatsphere.user;

import com.chatsphere.common.error.ApiException;
import com.chatsphere.common.security.SecurityUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

/**
 * Key exchange for end-to-end encrypted direct chats.
 *
 * The server is a notice board here, nothing more. It hands out public keys so two
 * people can derive a shared secret, and it stores each user's private key as an
 * opaque blob that only their password can unwrap. It cannot read a message, and
 * these endpoints are the reason it cannot: at no point does a plaintext private key
 * or a password pass through them.
 */
@RestController
@RequestMapping("/api/keys")
public class KeyController {

    private final UserRepository userRepository;

    public KeyController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /** What the client uploads after generating (or re-wrapping) its identity. */
    public record PublishKeysRequest(
            String publicKey,
            String encPrivateKey,
            String encKeySalt,
            String encKeyIv,
            /** True when the key pair is NEW, not just re-wrapped under a new password. */
            boolean rotated) {}

    /** My own key material, so a fresh device can restore it with my password. */
    public record MyKeysResponse(
            String publicKey,
            String encPrivateKey,
            String encKeySalt,
            String encKeyIv,
            int keyVersion) {}

    /** Somebody else's public key — all that is needed to encrypt to them. */
    public record PublicKeyResponse(Long userId, String publicKey, int keyVersion) {}

    @GetMapping("/me")
    @Transactional(readOnly = true)
    public MyKeysResponse mine() {
        User me = userRepository.findById(SecurityUtils.currentUserId())
                .orElseThrow(() -> ApiException.notFound("User not found"));
        return new MyKeysResponse(me.getPublicKey(), me.getEncPrivateKey(),
                me.getEncKeySalt(), me.getEncKeyIv(), me.getKeyVersion());
    }

    /**
     * Publish my public key and my password-wrapped private key.
     *
     * Called once when encryption is first set up, and again whenever the password
     * changes — the wrapped key must be re-wrapped under the new password, or the
     * user would lock themselves out of their own history by changing it.
     */
    @PostMapping
    @Transactional
    public ResponseEntity<Void> publish(@RequestBody PublishKeysRequest req) {
        if (req == null || isBlank(req.publicKey()) || isBlank(req.encPrivateKey())
                || isBlank(req.encKeySalt()) || isBlank(req.encKeyIv())) {
            throw ApiException.badRequest("Incomplete key material");
        }
        User me = userRepository.findById(SecurityUtils.currentUserId())
                .orElseThrow(() -> ApiException.notFound("User not found"));

        boolean newKeyPair = req.rotated() || me.getPublicKey() == null
                || !req.publicKey().equals(me.getPublicKey());

        me.setPublicKey(req.publicKey());
        me.setEncPrivateKey(req.encPrivateKey());
        me.setEncKeySalt(req.encKeySalt());
        me.setEncKeyIv(req.encKeyIv());
        // Only a genuinely NEW key pair bumps the version. Re-wrapping the same key
        // under a new password is not a rotation — the peer's derived secret, and so
        // every message they can already read, is unchanged.
        if (newKeyPair) {
            me.setKeyVersion(me.getKeyVersion() + 1);
        }
        userRepository.save(me);
        return ResponseEntity.noContent().build();
    }

    /** The public key of the person I want to message. */
    @GetMapping("/{userId}")
    @Transactional(readOnly = true)
    public PublicKeyResponse of(@PathVariable Long userId) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));
        return new PublicKeyResponse(u.getId(), u.getPublicKey(), u.getKeyVersion());
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
