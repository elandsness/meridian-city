package com.meridian.transaction.service;

import com.meridian.transaction.domain.Bill;
import com.meridian.transaction.messaging.TransactionEventPublisher;
import com.meridian.transaction.repository.BillRepository;
import com.meridian.transaction.util.BusinessEventLogger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Generates a random-length quarterly bill history for an identity at registration.
 * The most recent 1-2 quarters are outstanding; older quarters are paid. Only outstanding
 * bills emit events (issued -> paid funnel + inbox); the paid history is seeded data.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BillGenerationService {

    private final BillRepository billRepository;
    private final BusinessEventLogger businessEventLogger;
    private final TransactionEventPublisher transactionEventPublisher;

    @Transactional
    public void generateForIdentity(String identityId) {
        // Idempotent: don't regenerate if a redelivered event re-fires.
        if (billRepository.countByIdentityId(identityId) > 0) {
            log.debug("Bills already exist for identity={}, skipping generation", identityId);
            return;
        }

        ThreadLocalRandom rnd = ThreadLocalRandom.current();
        int quarters = 2 + rnd.nextInt(7);           // 2..8 quarters of history
        int outstandingCount = 1 + rnd.nextInt(2);   // newest 1..2 quarters unpaid

        LocalDate today = LocalDate.now();
        int currentQuarterIndex = today.getYear() * 4 + (today.getMonthValue() - 1) / 3;

        for (int i = quarters; i >= 1; i--) {
            int qi = currentQuarterIndex - i;        // i completed quarters ago
            int year = Math.floorDiv(qi, 4);
            int q = Math.floorMod(qi, 4);            // 0..3
            String period = year + "-Q" + (q + 1);

            OffsetDateTime issuedAt = LocalDate.of(year, q * 3 + 1, 1)
                    .atStartOfDay().atOffset(ZoneOffset.UTC);
            OffsetDateTime dueAt = issuedAt.plusDays(45);
            int amount = 15000 + rnd.nextInt(30001); // $150.00 - $450.00
            boolean outstanding = i <= outstandingCount;

            Bill bill = billRepository.save(Bill.builder()
                    .id(Bill.newId())
                    .identityId(identityId)
                    .period(period)
                    .amountCents(amount)
                    .status(outstanding ? "outstanding" : "paid")
                    .issuedAt(issuedAt)
                    .dueAt(dueAt)
                    .paidAt(outstanding ? null : dueAt.minusDays(5))
                    .createdAt(OffsetDateTime.now())
                    .build());

            if (outstanding) {
                businessEventLogger.billIssued(bill.getId(), identityId, period, amount);
                transactionEventPublisher.publishBillEvent("bill.issued", bill);
            }
        }
        log.info("Generated {} bills ({} outstanding) for identity={}",
                quarters, outstandingCount, identityId);
    }
}
