package com.meridian.billing.web;

import com.meridian.billing.dto.BillResponse;
import com.meridian.billing.service.BillService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/billing")
@RequiredArgsConstructor
public class BillController {

    private final BillService billService;

    @GetMapping("/bills")
    public List<BillResponse> list(@RequestParam(name = "citizen_id", required = false) String citizenId,
                                   @RequestParam(name = "status", required = false) String status) {
        return billService.listBills(citizenId, status);
    }

    @GetMapping("/bills/{id}")
    public BillResponse get(@PathVariable String id) {
        return billService.getBill(id);
    }

    @PostMapping("/bills/{id}/pay")
    public BillResponse pay(@PathVariable String id) {
        return billService.pay(id);
    }
}
