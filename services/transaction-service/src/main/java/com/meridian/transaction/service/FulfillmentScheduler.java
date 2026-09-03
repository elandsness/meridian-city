package com.meridian.transaction.service;

import com.meridian.transaction.config.FulfillmentProperties;
import com.meridian.transaction.domain.Order;
import com.meridian.transaction.messaging.TransactionEventPublisher;
import com.meridian.transaction.repository.OrderRepository;
import com.meridian.transaction.util.BusinessEventLogger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Advances orders through the simulated lifecycle on a timer:
 * placed -> packed -> shipped -> delivered. Each transition emits a business
 * event + a Kafka transaction.events message (consumed by the per-citizen inbox).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class FulfillmentScheduler {

    private static final String CARRIER = "Meridian Logistics";

    private final OrderRepository orderRepository;
    private final BusinessEventLogger businessEventLogger;
    private final TransactionEventPublisher transactionEventPublisher;
    private final FulfillmentProperties fulfillment;

    @Scheduled(fixedDelay = 10_000)
    @Transactional
    public void advanceOrders() {
        List<Order> due = orderRepository
                .findByStatusNotAndNextTransitionAtLessThanEqual(OffsetDateTime.now());
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
                order.setNextTransitionAt(now.plusSeconds(randomDelay(
                        fulfillment.getPackedMinSeconds(), fulfillment.getPackedMaxSeconds())));
            }
            case "packed" -> {
                order.setStatus("shipped");
                order.setShippedAt(now);
                order.setNextTransitionAt(now.plusSeconds(randomDelay(
                        fulfillment.getShippedMinSeconds(), fulfillment.getShippedMaxSeconds())));
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
                businessEventLogger.orderPacked(order.getId(), order.getCartId(), order.getIdentityId());
                transactionEventPublisher.publishOrderEvent("order.packed", order);
            }
            case "shipped" -> {
                businessEventLogger.orderShipped(order.getId(), order.getCartId(), order.getIdentityId(), CARRIER);
                transactionEventPublisher.publishOrderEvent("order.shipped", order);
            }
            case "delivered" -> {
                businessEventLogger.orderDelivered(order.getId(), order.getCartId(), order.getIdentityId());
                transactionEventPublisher.publishOrderEvent("order.delivered", order);
            }
        }
    }

    private int randomDelay(int min, int max) {
        return min + ThreadLocalRandom.current().nextInt(Math.max(1, max - min + 1));
    }
}
