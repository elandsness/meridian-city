package com.meridian.transaction.web;

import com.meridian.transaction.dto.BillResponse;
import com.meridian.transaction.service.BillService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/transaction/bills")
@RequiredArgsConstructor
public class BillController {

    private final BillService billService;

    @GetMapping
    public List<BillResponse> list(@RequestParam(name = "identity_id", required = false) String identityId,
                                   @RequestParam(name = "status", required = false) String status) {
        return billService.listBills(identityId, status);
    }

    @GetMapping("/{id}")
    public BillResponse get(@PathVariable String id) {
        return billService.getBill(id);
    }

    @PostMapping("/{id}/pay")
    public BillResponse pay(@PathVariable String id) {
        return billService.pay(id);
    }
}
