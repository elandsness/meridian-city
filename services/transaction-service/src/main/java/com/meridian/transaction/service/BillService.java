package com.meridian.transaction.service;

import com.meridian.transaction.config.FaultState;
import com.meridian.transaction.domain.Bill;
import com.meridian.transaction.domain.Payment;
import com.meridian.transaction.dto.BillResponse;
import com.meridian.transaction.messaging.TransactionEventPublisher;
import com.meridian.transaction.repository.BillRepository;
import com.meridian.transaction.repository.PaymentRepository;
import com.meridian.transaction.util.BusinessEventLogger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
@Slf4j
public class BillService {

    private final BillRepository billRepository;
    private final PaymentRepository paymentRepository;
    private final BusinessEventLogger businessEventLogger;
    private final TransactionEventPublisher transactionEventPublisher;
    private final FaultState faultState;

    @Transactional(readOnly = true)
    public List<BillResponse> listBills(String identityId, String status) {
        if (identityId == null || identityId.isBlank()) {
            return List.of();
        }
        List<Bill> bills = (status == null || status.isBlank())
                ? billRepository.findByIdentityIdOrderByIssuedAtDesc(identityId)
                : billRepository.findByIdentityIdAndStatusOrderByIssuedAtDesc(identityId, status.toLowerCase());
        return bills.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public BillResponse getBill(String id) {
        return toResponse(getOrThrow(id));
    }

    @Transactional
    public BillResponse pay(String id) {
        Bill bill = getOrThrow(id);
        if ("paid".equalsIgnoreCase(bill.getStatus())) {
            return toResponse(bill); // idempotent — already paid
        }
        // Business-exception (gated, default off): fail a share of payments at the gateway.
        // Emits transaction.payment_failed on the same bill.id and rejects with 402 — the bill
        // stays outstanding — so the payment flow shows an error branch + drop-off at the
        // Payment step.
        if (faultState.isPaymentFailEnabled()
                && ThreadLocalRandom.current().nextDouble() < faultState.getPaymentFailRate()) {
            businessEventLogger.billPaymentFailed(bill.getId(), bill.getIdentityId(), bill.getAmountCents());
            transactionEventPublisher.publishBillEvent("bill.payment_failed", bill);
            log.warn("Bill payment failed (fault) bill={} identity={}", bill.getId(), bill.getIdentityId());
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "payment failed");
        }
        bill.setStatus("paid");
        bill.setPaidAt(OffsetDateTime.now());
        bill = billRepository.save(bill);

        // Record the payment for tracking.
        Payment payment = Payment.create(bill.getIdentityId(), bill.getId(), bill.getAmountCents(), "completed");
        paymentRepository.save(payment);

        log.info("Bill paid: bill={} identity={} amount_cents={}",
                bill.getId(), bill.getIdentityId(), bill.getAmountCents());
        businessEventLogger.billPaymentCompleted(bill.getId(), bill.getIdentityId(), bill.getAmountCents());
        transactionEventPublisher.publishBillEvent("bill.payment_completed", bill);
        return toResponse(bill);
    }

    private Bill getOrThrow(String id) {
        return billRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "bill not found: " + id));
    }

    private BillResponse toResponse(Bill b) {
        return BillResponse.builder()
                .id(b.getId())
                .identityId(b.getIdentityId())
                .period(b.getPeriod())
                .amountCents(b.getAmountCents())
                .status(b.getStatus())
                .issuedAt(b.getIssuedAt())
                .dueAt(b.getDueAt())
                .paidAt(b.getPaidAt())
                .build();
    }
}
