package com.chatsphere.report;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;

public interface ReportRepository extends JpaRepository<Report, Long> {

    /**
     * Has this reporter already reported this target recently? Used to swallow
     * duplicate taps / repeat reports so one annoyed user cannot flood the table.
     */
    boolean existsByReporterIdAndReportedIdAndCreatedAtAfter(
            Long reporterId, Long reportedId, Instant since);
}
