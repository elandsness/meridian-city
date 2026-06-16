package com.meridian.billing.service;

import com.meridian.billing.domain.TaxBill;
import com.meridian.billing.dto.BillResponse;
import com.meridian.billing.messaging.BillingEventPublisher;
import com.meridian.billing.repository.TaxBillRepository;
import com.meridian.billing.util.BusinessEventLogger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class BillService {

    private final TaxBillRepository taxBillRepository;
    private final BusinessEventLogger businessEventLogger;
    private final BillingEventPublisher billingEventPublisher;

    @Transactional(readOnly = true)
    public List<BillResponse> listBills(String citizenId, String status) {
        if (citizenId == null || citizenId.isBlank()) {
            return List.of();
        }
        List<TaxBill> bills = (status == null || status.isBlank())
                ? taxBillRepository.findByCitizenIdOrderByIssuedAtDesc(citizenId)
                : taxBillRepository.findByCitizenIdAndStatusOrderByIssuedAtDesc(citizenId, status.toLowerCase());
        return bills.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public BillResponse getBill(String id) {
        return toResponse(getOrThrow(id));
    }

    @Transactional
    public BillResponse pay(String id) {
        TaxBill bill = getOrThrow(id);
        if ("paid".equalsIgnoreCase(bill.getStatus())) {
            return toResponse(bill); // idempotent — already paid
        }
        bill.setStatus("paid");
        bill.setPaidAt(OffsetDateTime.now());
        bill = taxBillRepository.save(bill);
        log.info("Tax bill paid: bill={} citizen={} amount_cents={}",
                bill.getId(), bill.getCitizenId(), bill.getAmountCents());
        businessEventLogger.taxPaymentCompleted(bill.getId(), bill.getCitizenId(), bill.getAmountCents());
        billingEventPublisher.publish("tax.payment_completed", bill);
        return toResponse(bill);
    }

    private TaxBill getOrThrow(String id) {
        return taxBillRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "bill not found: " + id));
    }

    private BillResponse toResponse(TaxBill b) {
        return BillResponse.builder()
                .id(b.getId())
                .citizenId(b.getCitizenId())
                .period(b.getPeriod())
                .amountCents(b.getAmountCents())
                .status(b.getStatus())
                .issuedAt(b.getIssuedAt())
                .dueAt(b.getDueAt())
                .paidAt(b.getPaidAt())
                .build();
    }
}
