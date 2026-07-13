package com.chatsphere.contact;

import com.chatsphere.common.security.SecurityUtils;
import com.chatsphere.contact.dto.ContactDtos.AddContactRequest;
import com.chatsphere.contact.dto.ContactDtos.ContactDto;
import com.chatsphere.contact.dto.ContactDtos.ContactRequestDto;
import com.chatsphere.contact.dto.ContactDtos.QrAddRequest;
import com.chatsphere.contact.dto.ContactDtos.SendRequestResult;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/contacts")
public class ContactController {

    private final ContactService contactService;

    public ContactController(ContactService contactService) {
        this.contactService = contactService;
    }

    @GetMapping
    public List<ContactDto> list() {
        return contactService.list(SecurityUtils.currentUserId());
    }

    /** Sends a contact invitation (does NOT add directly). */
    @PostMapping
    public SendRequestResult add(@Valid @RequestBody AddContactRequest req) {
        return contactService.sendRequest(SecurityUtils.currentUserId(), req);
    }

    /** Scan a QR code to send that user a contact invitation (they accept manually). */
    @PostMapping("/qr")
    public SendRequestResult addByQr(@Valid @RequestBody QrAddRequest req) {
        return contactService.requestByQr(SecurityUtils.currentUserId(), req.code());
    }

    /** Open an invite link (/i/<code>) to send that user a contact invitation. */
    @PostMapping("/invite")
    public SendRequestResult addByInvite(@Valid @RequestBody QrAddRequest req) {
        return contactService.requestByInvite(SecurityUtils.currentUserId(), req.code());
    }

    @GetMapping("/requests")
    public List<ContactRequestDto> incoming() {
        return contactService.incomingRequests(SecurityUtils.currentUserId());
    }

    @GetMapping("/requests/outgoing")
    public List<ContactRequestDto> outgoing() {
        return contactService.outgoingRequests(SecurityUtils.currentUserId());
    }

    @PostMapping("/requests/{id}/accept")
    public ResponseEntity<Void> accept(@PathVariable Long id) {
        contactService.accept(SecurityUtils.currentUserId(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/requests/{id}/decline")
    public ResponseEntity<Void> decline(@PathVariable Long id) {
        contactService.decline(SecurityUtils.currentUserId(), id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> remove(@PathVariable Long id) {
        contactService.remove(SecurityUtils.currentUserId(), id);
        return ResponseEntity.noContent().build();
    }
}
