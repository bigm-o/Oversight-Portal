---
name: implementing-core-services
description: Provides architectural patterns and implementation guides for essential backend services like Authentication (IAM), Logging, Security, Payments, Notifications, and Error Handling. Use when designing or implementing backend infrastructure.
---

# Implementing Core Services

## Overview

Use this skill to implement standardized, robust backend services. Instead of reinventing the wheel, follow these architectural patterns and implementation guides for common requirements.

## When to Use

- When the user asks to "add authentication" or "setup logging".
- When implementing payments (Stripe/Paypal).
- When configuring notifications (Email/SMS).
- When designing error handling or data validation layers.
- When setting up API Gateways or CDNs.

## Service Catalog & Implementation Patterns

### 1. Identity and Access Management (IAM)
**Goal:** Secure authentication and authorization.
- **Pattern:** Use established providers (Auth0, Clerk, Supabase Auth) or libraries (NextAuth.js, Passport.js).
- **Implementation:**
  - **AuthN:** JWT (access tokens) + Refresh Tokens (HttpOnly cookies).
  - **AuthZ:** Role-Based Access Control (RBAC) middleware.
  - **Security:** CSRF protection, Rate limiting on login endpoints.

### 2. Logging and Monitoring
**Goal:** Observability and debugging.
- **Pattern:** Structured logging (JSON) + Centralized aggregation.
- **Tools:** Winston/Pino (Node.js), Logrus (Go), Sentry (Error tracking), Datadog/ELK (Aggregation).
- **Implementation:**
  - Log levels: DEBUG, INFO, WARN, ERROR.
  - Include correlation IDs (X-Request-ID) in all logs.
  - Mask sensitive data (PII, tokens) before logging.

### 3. Data Validation & Error Handling
**Goal:** Prevent invalid data and ensure graceful failures.
- **Pattern:** Schema-based validation + Centralized error middleware.
- **Tools:** Zod (TypeScript), Joi, Pydantic (Python).
- **Implementation:**
  - Validate all inputs at the API boundary (Controller/Resolver).
  - Use a global error handler to format responses (status code + message).
  - Never expose stack traces in production.

### 4. Notification Service
**Goal:** Deliver transactional emails, SMS, or pushes.
- **Pattern:** Async queue (Redis/BullMQ) + Provider abstraction.
- **Tools:** SendGrid/Resend (Email), Twilio (SMS), Firebase (Push).
- **Implementation:**
  - Decouple sending from the main request flow (fire-and-forget).
  - Implement retries and dead-letter queues (DLQ).
  - Use templates for content.

### 5. Payment and Billing
**Goal:** Process transactions securely.
- **Pattern:** Webhook-driven state machine.
- **Tools:** Stripe, PayPal, Lemon Squeezy.
- **Implementation:**
  - Never store raw credit card details (use tokenization/PCI compliance).
  - Use idempotency keys to prevent double-charging.
  - Rely on webhooks to update order status (don't trust the client).

### 6. File Storage and CDN
**Goal:** Store and serve user uploads efficiently.
- **Pattern:** Object Storage + Content Delivery Network.
- **Tools:** AWS S3, Google Cloud Storage, Cloudflare R2, UploadThing.
- **Implementation:**
  - Generate pre-signed URLs for uploads (security).
  - Serve public assets via CDN (Cloudflare/CloudFront).
  - Validate file types and sizes strictly.

### 7. Caching Service
**Goal:** Improve read performance.
- **Pattern:** Cache-Aside or Write-Through.
- **Tools:** Redis, Memcached.
- **Implementation:**
  - Cache expensive DB queries or API responses.
  - Set appropriate TTL (Time To Live).
  - Implement cache invalidation strategies on updates.

### 8. API Gateway
**Goal:** Request routing, composition, and security.
- **Pattern:** Reverse Proxy / Gateway.
- **Tools:** Nginx, Kong, Traefik, AWS API Gateway.
- **Implementation:**
  - Centralize rate limiting, CORS, and authentication verification.
  - Route requests to appropriate microservices (if applicable).

### 9. Audit Logging
**Goal:** Track critical system actions for compliance.
- **Pattern:** Immutable append-only log.
- **Implementation:**
  - Record: Who (User ID), What (Action), When (Timestamp), Where (IP/Resource), Why (Reason).
  - Store separately from application logs (e.g., dedicated DB table or cold storage).

## Workflow

1.  **Select Service:** Identify which Core Service is needed.
2.  **Choose Pattern:** Pick the appropriate pattern based on the tech stack (e.g., Next.js vs Go).
3.  **Draft Configuration:** Create the necessary config files (e.g., `logger.ts`, `auth.config.ts`).
4.  **Implement Middleware:** Add the service to the request pipeline.
5.  **Validate:** Test with valid and invalid inputs to ensure robustness.

## Example: Adding Structured Logging (Node.js/Pino)

1.  install `pino` and `pino-pretty`.
2.  Create `lib/logger.ts`.
3.  Configure redaction for keys like `password`, `token`.
4.  Example Usage: `logger.info({ userId, action: 'login' }, 'User logged in')`.
