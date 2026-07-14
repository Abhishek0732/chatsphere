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

    private final UserKeyRepository keyRepository;
    private final UserRepository userRepository;

    public KeyController(UserKeyRepository keyRepository, UserRepository userRepository) {
        this.keyRepository = keyRepository;
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
        return keyRepository.findById(SecurityUtils.currentUserId())
                .map(k -> new MyKeysResponse(k.getPublicKey(), k.getEncPrivateKey(),
                        k.getEncKeySalt(), k.getEncKeyIv(), k.getKeyVersion()))
                // No keys yet: the client makes a pair and publishes it.
                .orElseGet(() -> new MyKeysResponse(null, null, null, null, 0));
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
        Long me = SecurityUtils.currentUserId();

        UserKey key = keyRepository.findById(me).orElseGet(() -> {
            UserKey k = new UserKey();
            k.setUserId(me);
            k.setKeyVersion(0);
            return k;
        });

        boolean newKeyPair = req.rotated()
                || key.getPublicKey() == null
                || !req.publicKey().equals(key.getPublicKey());

        key.setPublicKey(req.publicKey());
        key.setEncPrivateKey(req.encPrivateKey());
        key.setEncKeySalt(req.encKeySalt());
        key.setEncKeyIv(req.encKeyIv());
        // Only a genuinely NEW key pair bumps the version. Re-wrapping the same key
        // under a new password is not a rotation — the peer's derived secret, and so
        // every message they can already read, is unchanged.
        if (newKeyPair) {
            key.setKeyVersion(key.getKeyVersion() + 1);
        }
        keyRepository.save(key);
        return ResponseEntity.noContent().build();
    }

    /** The public key of the person I want to message. */
    @GetMapping("/{userId}")
    @Transactional(readOnly = true)
    public PublicKeyResponse of(@PathVariable Long userId) {
        if (!userRepository.existsById(userId)) {
            throw ApiException.notFound("User not found");
        }
        return keyRepository.findById(userId)
                .map(k -> new PublicKeyResponse(userId, k.getPublicKey(), k.getKeyVersion()))
                // They have not set up encryption. The client falls back to sending in
                // the clear rather than sending them something they can never read.
                .orElseGet(() -> new PublicKeyResponse(userId, null, 0));
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
