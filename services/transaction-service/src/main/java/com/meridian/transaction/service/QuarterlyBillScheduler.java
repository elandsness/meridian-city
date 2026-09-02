package com.meridian.transaction.service;

import com.meridian.transaction.config.QuarterlyBillProperties;
import com.meridian.transaction.domain.Bill;
import com.meridian.transaction.messaging.TransactionEventPublisher;
import com.meridian.transaction.repository.BillRepository;
import com.meridian.transaction.util.BusinessEventLogger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Issues a new outstanding bill to every existing identity at the start of each
 * quarter (Jan=Q1, Apr=Q2, Jul=Q3, Oct=Q4), so the data keeps feeling real in a
 * long-running lab. Idempotent per (identity_id, period): an identity who already has a
 * bill for the current quarter is skipped, so the job is safe to run on any cadence.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class QuarterlyBillScheduler {

    private final BillRepository billRepository;
    private final BusinessEventLogger businessEventLogger;
    private final TransactionEventPublisher transactionEventPublisher;
    private final QuarterlyBillProperties props;

    @Scheduled(
            fixedDelayString = "${billing.quarterly.interval-ms:3600000}",
            initialDelayString = "${billing.quarterly.initial-delay-ms:60000}")
    @Transactional
    public void issueCurrentQuarterBills() {
        if (!props.isEnabled()) {
            return;
        }

        LocalDate today = LocalDate.now();
        int q = (today.getMonthValue() - 1) / 3;     // 0..3
        int year = today.getYear();
        String period = year + "-Q" + (q + 1);

        OffsetDateTime issuedAt = LocalDate.of(year, q * 3 + 1, 1)
                .atStartOfDay().atOffset(ZoneOffset.UTC);
        OffsetDateTime dueAt = issuedAt.plusDays(props.getDueDays());

        List<String> identityIds = billRepository.findDistinctIdentityIds();
        int issued = 0;
        for (String identityId : identityIds) {
            if (billRepository.existsByIdentityIdAndPeriod(identityId, period)) {
                continue;
            }
            int amount = props.getMinAmountCents()
                    + ThreadLocalRandom.current().nextInt(
                            Math.max(1, props.getMaxAmountCents() - props.getMinAmountCents() + 1));

            Bill bill = billRepository.save(Bill.builder()
                    .id(Bill.newId())
                    .identityId(identityId)
                    .period(period)
                    .amountCents(amount)
                    .status("outstanding")
                    .issuedAt(issuedAt)
                    .dueAt(dueAt)
                    .paidAt(null)
                    .createdAt(OffsetDateTime.now())
                    .build());

            businessEventLogger.billIssued(bill.getId(), identityId, period, amount);
            transactionEventPublisher.publishBillEvent("bill.issued", bill);
            issued++;
        }

        if (issued > 0) {
            log.info("Quarterly issuance: issued {} new {} bills", issued, period);
        }
    }
}
