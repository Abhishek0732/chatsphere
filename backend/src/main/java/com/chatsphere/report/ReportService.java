package com.chatsphere.report;

import com.chatsphere.common.error.ApiException;
import com.chatsphere.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;

@Service
public class ReportService {

    /** Longest reason/detail we store, matching the column widths. */
    private static final int REASON_MAX = 80;
    private static final int DETAILS_MAX = 1000;

    /** One report per (reporter, target) inside this window is enough of a signal. */
    private static final Duration DEDUPE_WINDOW = Duration.ofHours(24);

    private final ReportRepository reportRepository;
    private final UserRepository userRepository;

    public ReportService(ReportRepository reportRepository, UserRepository userRepository) {
        this.reportRepository = reportRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public void report(Long actorId, Long targetId, String reason, String details, Long messageId) {
        if (Objects.equals(actorId, targetId)) {
            throw ApiException.badRequest("You cannot report yourself");
        }
        userRepository.findById(targetId)
                .orElseThrow(() -> ApiException.notFound("User not found"));

        String cleanReason = reason == null || reason.isBlank() ? "other" : reason.trim();
        if (cleanReason.length() > REASON_MAX) cleanReason = cleanReason.substring(0, REASON_MAX);
        String cleanDetails = details == null || details.isBlank() ? null : details.trim();
        if (cleanDetails != null && cleanDetails.length() > DETAILS_MAX) {
            cleanDetails = cleanDetails.substring(0, DETAILS_MAX);
        }

        // Swallow a repeat report from the same person within the window — the first
        // one is the signal; the rest are noise (and a spam vector).
        if (reportRepository.existsByReporterIdAndReportedIdAndCreatedAtAfter(
                actorId, targetId, Instant.now().minus(DEDUPE_WINDOW))) {
            return;
        }

        Report r = new Report();
        r.setReporterId(actorId);
        r.setReportedId(targetId);
        r.setReason(cleanReason);
        r.setDetails(cleanDetails);
        r.setMessageId(messageId);
        reportRepository.save(r);
    }
}
