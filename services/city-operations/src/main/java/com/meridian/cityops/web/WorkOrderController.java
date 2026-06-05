package com.meridian.cityops.web;

import com.meridian.cityops.dto.CreateWorkOrderDto;
import com.meridian.cityops.dto.WorkOrderResponse;
import com.meridian.cityops.service.WorkOrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/work-orders")
@RequiredArgsConstructor
@Slf4j
public class WorkOrderController {

    private final WorkOrderService workOrderService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WorkOrderResponse createWorkOrder(@RequestBody CreateWorkOrderDto dto) {
        log.info("POST /api/v1/work-orders requestId={}", dto.getRequestId());
        return workOrderService.createFromRequest(dto);
    }

    @GetMapping("/{id}")
    public WorkOrderResponse getWorkOrder(@PathVariable String id) {
        return workOrderService.findById(id);
    }

    @GetMapping
    public List<WorkOrderResponse> listWorkOrders(
            @RequestParam(required = false) String status) {
        return workOrderService.findByStatus(status);
    }

    @PatchMapping("/{id}/status")
    public WorkOrderResponse updateStatus(@PathVariable String id,
                                          @RequestBody Map<String, String> body) {
        String status = body.get("status");
        return workOrderService.updateStatus(id, status);
    }
}
