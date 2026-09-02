package com.meridian.workflow.web;

import com.meridian.workflow.dto.CreateWorkOrderDto;
import com.meridian.workflow.dto.WorkOrderResponse;
import com.meridian.workflow.service.WorkOrderService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/work-orders")
public class WorkOrderController {

    private final WorkOrderService workOrderService;

    public WorkOrderController(WorkOrderService workOrderService) {
        this.workOrderService = workOrderService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WorkOrderResponse createWorkOrder(@RequestBody CreateWorkOrderDto request) {
        return workOrderService.createWorkOrder(request);
    }

    @GetMapping("/{id}")
    public WorkOrderResponse findById(@PathVariable String id) {
        return workOrderService.findById(id);
    }

    @GetMapping
    public List<WorkOrderResponse> listByStatus(@RequestParam(required = false) String status) {
        if (status != null && !status.isBlank()) {
            return workOrderService.listByStatus(status);
        }
        return List.of();
    }

    @PatchMapping("/{id}/status")
    public WorkOrderResponse updateStatus(@PathVariable String id, @RequestBody java.util.Map<String, String> body) {
        String status = body.get("status");
        if (status == null || status.isBlank()) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "status is required");
        }
        return workOrderService.updateStatus(id, status);
    }
}
