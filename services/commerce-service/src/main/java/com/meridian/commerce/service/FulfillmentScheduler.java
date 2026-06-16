package com.meridian.commerce.service;

import com.meridian.commerce.config.FulfillmentProperties;
import com.meridian.commerce.domain.Order;
import com.meridian.commerce.messaging.OrderEventPublisher;
import com.meridian.commerce.repository.OrderRepository;
import com.meridian.commerce.util.BusinessEventLogger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Advances orders through the simulated lifecycle on a timer:
 * placed -> packed -> shipped -> delivered. Each transition emits a business
 * event + a Kafka commerce.events message (consumed by the per-citizen inbox).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class FulfillmentScheduler {

    private static final String CARRIER = "Meridian Logistics";

    private final OrderRepository orderRepository;
    private final BusinessEventLogger businessEventLogger;
    private final OrderEventPublisher orderEventPublisher;
    private final FulfillmentProperties fulfillment;

    @Scheduled(fixedDelay = 10_000)
    @Transactional
    public void advanceOrders() {
        List<Order> due = orderRepository
                .findByStatusNotAndNextTransitionAtLessThanEqual("delivered", OffsetDateTime.now());
        for (Order order : due) {
            advance(order);
        }
    }

    private void advance(Order order) {
        OffsetDateTime now = OffsetDateTime.now();
        switch (order.getStatus()) {
            case "placed" -> {
                order.setStatus("packed");
                order.setPackedAt(now);
                order.setNextTransitionAt(now.plusSeconds(fulfillment.getShippedAfterSeconds()));
            }
            case "packed" -> {
                order.setStatus("shipped");
                order.setShippedAt(now);
                order.setNextTransitionAt(now.plusSeconds(fulfillment.getDeliveredAfterSeconds()));
            }
            case "shipped" -> {
                order.setStatus("delivered");
                order.setDeliveredAt(now);
                order.setNextTransitionAt(null);
            }
            default -> {
                return;
            }
        }
        order.setUpdatedAt(now);
        orderRepository.save(order);

        switch (order.getStatus()) {
            case "packed" -> {
                businessEventLogger.orderPacked(order.getId(), order.getCitizenId());
                orderEventPublisher.publishOrderEvent("order.packed", order);
            }
            case "shipped" -> {
                businessEventLogger.orderShipped(order.getId(), order.getCitizenId(), CARRIER);
                orderEventPublisher.publishOrderEvent("order.shipped", order);
            }
            case "delivered" -> {
                businessEventLogger.orderDelivered(order.getId(), order.getCitizenId());
                orderEventPublisher.publishOrderEvent("order.delivered", order);
            }
        }
    }
}
