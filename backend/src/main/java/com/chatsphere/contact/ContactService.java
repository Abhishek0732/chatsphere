package com.chatsphere.contact;

import com.chatsphere.chat.ChatService;
import com.chatsphere.common.error.ApiException;
import com.chatsphere.common.util.QrTokens;
import com.chatsphere.contact.ContactRequest.Status;
import com.chatsphere.contact.dto.ContactDtos.AddContactRequest;
import com.chatsphere.contact.dto.ContactDtos.ContactDto;
import com.chatsphere.contact.dto.ContactDtos.ContactRequestDto;
import com.chatsphere.contact.dto.ContactDtos.SendRequestResult;
import com.chatsphere.notification.NotificationService;
import com.chatsphere.presence.PresenceService;
import com.chatsphere.user.User;
import com.chatsphere.user.UserRepository;
import com.chatsphere.user.dto.UserDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

@Service
public class ContactService {

    private final ContactRepository contactRepository;
    private final ContactRequestRepository requestRepository;
    private final UserRepository userRepository;
    private final PresenceService presenceService;
    private final NotificationService notificationService;
    private final ChatService chatService;

    public ContactService(ContactRepository contactRepository,
                          ContactRequestRepository requestRepository,
                          UserRepository userRepository,
                          PresenceService presenceService,
                          NotificationService notificationService,
                          ChatService chatService) {
        this.contactRepository = contactRepository;
        this.requestRepository = requestRepository;
        this.userRepository = userRepository;
        this.presenceService = presenceService;
        this.notificationService = notificationService;
        this.chatService = chatService;
    }

    @Transactional(readOnly = true)
    public List<ContactDto> list(Long ownerId) {
        return contactRepository.findByOwnerIdOrderByIdDesc(ownerId).stream()
                .map(this::toDto)
                .toList();
    }

    /**
     * Sends a contact invitation instead of adding the user directly. The recipient
     * must accept before either side becomes a contact. If the recipient had already
     * invited the sender, that pending invite is auto-accepted.
     */
    @Transactional
    public SendRequestResult sendRequest(Long senderId, AddContactRequest req) {
        Long recipientId = req.contactUserId();
        if (Objects.equals(senderId, recipientId)) {
            throw ApiException.badRequest("Cannot add yourself as a contact");
        }
        userRepository.findById(recipientId)
                .orElseThrow(() -> ApiException.notFound("User not found"));
        if (contactRepository.existsByOwnerIdAndContactUserId(senderId, recipientId)) {
            throw ApiException.conflict("Already in your contacts");
        }

        // If the other person already invited me, accept that instead of creating a new one.
        var reverse = requestRepository
                .findBySenderIdAndRecipientIdAndStatus(recipientId, senderId, Status.PENDING);
        if (reverse.isPresent()) {
            acceptRequest(reverse.get());
            return new SendRequestResult("ACCEPTED");
        }

        // Already have a pending invite out to this user? Don't duplicate.
        if (requestRepository
                .findBySenderIdAndRecipientIdAndStatus(senderId, recipientId, Status.PENDING)
                .isPresent()) {
            throw ApiException.conflict("Invitation already sent");
        }

        ContactRequest cr = new ContactRequest();
        cr.setSenderId(senderId);
        cr.setRecipientId(recipientId);
        cr.setStatus(Status.PENDING);
        requestRepository.save(cr);

        User sender = userRepository.findById(senderId).orElse(null);
        String senderName = sender != null ? sender.getDisplayName() : "Someone";
        notificationService.notifyUser(recipientId, "CONTACT_REQUEST",
                "Contact request", senderName + " wants to add you as a contact", senderId);

        return new SendRequestResult("PENDING");
    }

    @Transactional(readOnly = true)
    public List<ContactRequestDto> incomingRequests(Long userId) {
        return requestRepository.findByRecipientIdAndStatusOrderByIdDesc(userId, Status.PENDING).stream()
                .map(cr -> toRequestDto(cr, cr.getSenderId(), "INCOMING"))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ContactRequestDto> outgoingRequests(Long userId) {
        return requestRepository.findBySenderIdAndStatusOrderByIdDesc(userId, Status.PENDING).stream()
                .map(cr -> toRequestDto(cr, cr.getRecipientId(), "OUTGOING"))
                .toList();
    }

    @Transactional
    public void accept(Long userId, Long requestId) {
        ContactRequest cr = requestRepository.findByIdAndRecipientId(requestId, userId)
                .orElseThrow(() -> ApiException.notFound("Request not found"));
        if (cr.getStatus() != Status.PENDING) {
            throw ApiException.conflict("Request already handled");
        }
        acceptRequest(cr);
    }

    @Transactional
    public void decline(Long userId, Long requestId) {
        ContactRequest cr = requestRepository.findByIdAndRecipientId(requestId, userId)
                .orElseThrow(() -> ApiException.notFound("Request not found"));
        if (cr.getStatus() != Status.PENDING) {
            throw ApiException.conflict("Request already handled");
        }
        cr.setStatus(Status.DECLINED);
        cr.setRespondedAt(Instant.now());
        requestRepository.save(cr);
    }

    /** Marks a pending request accepted and creates the mutual contact rows. */
    private void acceptRequest(ContactRequest cr) {
        cr.setStatus(Status.ACCEPTED);
        cr.setRespondedAt(Instant.now());
        requestRepository.save(cr);

        createContactIfAbsent(cr.getSenderId(), cr.getRecipientId());
        createContactIfAbsent(cr.getRecipientId(), cr.getSenderId());

        // Materialise the direct conversation right away so both people see each
        // other in their chat list the moment they become contacts, without
        // having to open a chat first.
        chatService.getOrCreateDirect(cr.getSenderId(), cr.getRecipientId());

        User accepter = userRepository.findById(cr.getRecipientId()).orElse(null);
        String accepterName = accepter != null ? accepter.getDisplayName() : "Someone";
        notificationService.notifyUser(cr.getSenderId(), "CONTACT_ACCEPTED",
                "Contact request accepted", accepterName + " accepted your contact request",
                cr.getRecipientId());
    }

    private void createContactIfAbsent(Long ownerId, Long contactUserId) {
        if (contactRepository.existsByOwnerIdAndContactUserId(ownerId, contactUserId)) {
            return;
        }
        Contact c = new Contact();
        c.setOwnerId(ownerId);
        c.setContactUserId(contactUserId);
        contactRepository.save(c);
    }

    /**
     * Scanning a QR code resolves the owner and sends them a contact invitation —
     * it does NOT add directly. The owner accepts manually, exactly like a normal
     * request. Reuses {@link #sendRequest} so self/duplicate/reverse-accept
     * handling and notifications are identical.
     */
    @Transactional
    public SendRequestResult requestByQr(Long scannerId, String code) {
        String token = QrTokens.parse(code);
        if (token.isBlank()) {
            throw ApiException.badRequest("Invalid QR code");
        }
        User target = userRepository.findByQrToken(token)
                .orElseThrow(() -> ApiException.badRequest("This QR code is invalid or expired"));
        return sendRequest(scannerId, new AddContactRequest(target.getId(), null));
    }

    @Transactional
    public void remove(Long ownerId, Long contactId) {
        Contact c = contactRepository.findByIdAndOwnerId(contactId, ownerId)
                .orElseThrow(() -> ApiException.notFound("Contact not found"));
        contactRepository.delete(c);
    }

    private ContactDto toDto(Contact c) {
        return new ContactDto(c.getId(), userDto(c.getContactUserId()), c.getAlias(), c.getCreatedAt());
    }

    private ContactRequestDto toRequestDto(ContactRequest cr, Long otherUserId, String direction) {
        return new ContactRequestDto(cr.getId(), userDto(otherUserId), direction,
                cr.getStatus().name(), cr.getCreatedAt());
    }

    private UserDto userDto(Long userId) {
        User u = userRepository.findById(userId).orElse(null);
        return u == null ? null
                : UserDto.from(u, presenceService.isOnline(u.getId()), presenceService.lastSeen(u.getId()));
    }
}
