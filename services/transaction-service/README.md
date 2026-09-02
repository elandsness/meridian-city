# Transaction Service

Generic transaction service for managing carts, orders, bills, and payments.

## Overview

The transaction-service is a generic domain-pattern service that handles all transaction-related operations in the Meridian City platform. It replaces the domain-specific `commerce-service` and `billing-service`.

## Key Features

- **Carts**: Manage shopping carts with add/remove items
- **Orders**: Track order lifecycle (placed -> packed -> shipped -> delivered)
- **Bills**: Manage bills (tax bills, regulatory fees, etc.) with quarterly issuance
- **Payments**: Process bill payments with fault injection support

## API Endpoints

### Orders
- `POST /api/v1/transaction/checkout` - Checkout cart (creates order)
- `GET /api/v1/transaction/orders` - List orders (optional `?identity_id=` filter)
- `GET /api/v1/transaction/orders/{id}` - Get order by ID

### Carts
- `POST /api/v1/transaction/cart/items` - Add item to cart
- `GET /api/v1/transaction/cart` - Get active cart (optional `?identity_id=` filter)
- `GET /api/v1/transaction/cart/list` - List all carts (optional `?identity_id=` filter)
- `DELETE /api/v1/transaction/cart` - Clear cart (optional `?identity_id=` filter)

### Bills
- `GET /api/v1/transaction/bills` - List bills (optional `?identity_id=` and `?status=` filters)
- `GET /api/v1/transaction/bills/{id}` - Get bill by ID
- `POST /api/v1/transaction/bills/{id}/pay` - Pay bill

### Admin (internal, not exposed via gateway)
- `POST /admin/fault` - Configure fault injection (db-slowdown, payment-fail)

## Configuration

The transaction-service is configured via environment variables:

- `DB_HOST` - PostgreSQL host (default: `meridian-db-rw`)
- `DB_NAME` - Database name (default: `meridian`)
- `DB_USERNAME` - Database username (default: `meridian`)
- `DB_PASSWORD` - Database password
- `KAFKA_BOOTSTRAP_SERVERS` - Kafka bootstrap servers (default: `meridian-kafka-bootstrap:9092`)

### Fulfillment Configuration

- `FULFILLMENT_PACKED_MIN_SECONDS` - Min delay for placed->packed (default: 300)
- `FULFILLMENT_PACKED_MAX_SECONDS` - Max delay for placed->packed (default: 7200)
- `FULFILLMENT_SHIPPED_MIN_SECONDS` - Min delay for packed->shipped (default: 300)
- `FULFILLMENT_SHIPPED_MAX_SECONDS` - Max delay for packed->shipped (default: 7200)
- `FULFILLMENT_DELIVERED_MIN_SECONDS` - Min delay for shipped->delivered (default: 300)
- `FULFILLMENT_DELIVERED_MAX_SECONDS` - Max delay for shipped->delivered (default: 7200)

### Bill Issuance Configuration

- `BILLING_QUARTERLY_ENABLED` - Enable quarterly bill issuance (default: true)
- `BILLING_QUARTERLY_INTERVAL_MS` - Interval between checks (default: 3600000)
- `BILLING_QUARTERLY_INITIAL_DELAY_MS` - Initial delay before first run (default: 60000)
- `BILLING_QUARTERLY_MIN_AMOUNT_CENTS` - Min bill amount (default: 15000)
- `BILLING_QUARTERLY_MAX_AMOUNT_CENTS` - Max bill amount (default: 45000)
- `BILLING_QUARTERLY_DUE_DAYS` - Days from issue to due (default: 45)

### Fault Injection

- `FAULT_DB_SLOWDOWN_ENABLED` - Enable checkout latency (default: false)
- `FAULT_DB_SLOWDOWN_DELAY_MS` - Latency in ms (default: 0)
- `FAULT_PAYMENT_FAIL_ENABLED` - Enable payment failures (default: false)
- `FAULT_PAYMENT_FAIL_RATE` - Failure rate 0.0-1.0 (default: 0.0)

## Database Schema

The service uses the `transaction` schema with the following tables:

- `orders` - Customer orders
- `cart_items` - Items in shopping carts
- `carts` - Shopping carts
- `order_items` - Items in orders
- `bills` - Bills (tax, regulatory, etc.)
- `payments` - Payment records

## Kafka Topics

- `transaction.events` - Transaction events (cart, order, bill lifecycle)
- `identity.events` - Consumes `identity.registered` to generate initial bills

## Deployment

The transaction-service is deployed as a Kubernetes Deployment with a ClusterIP Service on port 8090.

## Dependencies

- Java 21
- Spring Boot 3.3.5
- PostgreSQL
- Kafka
- Flyway (database migrations)
