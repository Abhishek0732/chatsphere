package com.chatsphere.report;

import com.chatsphere.common.security.SecurityUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    /** Report a user. The reason/details/messageId all come in the body. */
    @PostMapping("/{userId}")
    public ResponseEntity<Void> report(@PathVariable Long userId, @RequestBody ReportRequest req) {
        reportService.report(SecurityUtils.currentUserId(), userId,
                req.reason(), req.details(), req.messageId());
        return ResponseEntity.noContent().build();
    }

    public record ReportRequest(String reason, String details, Long messageId) {}
}
