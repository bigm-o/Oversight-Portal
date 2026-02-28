# API Integrations Technical Guide

This document provides a comprehensive technical overview of the three core API integrations within the NIBSS Ticket Tracker. It is designed to serve as a reference for maintenance, debugging, and replication of the integration layer.

## Overview of Integrations

The system unifies data from three primary external sources into a centralized SQL database (PostgreSQL):
1. **JIRA**: Agile project tracking and delivery metrics.
2. **Freshdesk**: Level 1 (L1) incidents and service requests.
3. **Freshservice**: Level 2 (L2) and Level 4 (L4) internal service requests and escalations.

---

## 1. JIRA Integration

### Purpose
Syncs agile development data to track team velocity, sprint progress, and ticket movement history.

### Core Components
- **Service**: `JiraService.cs` (Handles HTTP communication)
- **Sync Logic**: `JiraSyncService.cs` (Handles project filtering and database mapping)
- **Base URL**: `https://{domain}.atlassian.net/rest/api/3`

### Configuration (.env)
```env
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_API_TOKEN=your_token
JIRA_EMAIL=your_email@nibss-plc.com.ng
JIRA_ENABLED=true
```

### Key Logic
- **Project Filtering**: The system is restricted to core agile spaces: `SKP`, `IR`, `CASP`, `BARP3`.
- **Pagination**: Uses JIRA v3 token-based pagination (`nextPageToken`) rather than traditional `startAt` offsets.
- **Mapping**:
  - Issues (issuetype != 'Epic') -> `tickets` table.
  - Epics (issuetype == 'Epic') -> `projects` table.
  - Change Log (status transitions) -> `ticket_movements` table.

---

## 2. Freshdesk Integration

### Purpose
Captures customer-facing Level 1 (L1) support requests.

### Core Components
- **Service**: `FreshdeskService.cs`
- **Base URL**: `https://{domain}.freshdesk.com/api/v2`
- **Auth**: Basic Authentication using `apiKey:X` encoded in Base64.

### Configuration (.env)
```env
FRESHDESK_DOMAIN=your-domain.freshdesk.com
FRESHDESK_API_KEY=your_api_key
FRESHDESK_ENABLED=true
```

### Key Logic
- **Sync Window**: Fetches tickets updated within the last 7 days (`updated_since={date}`).
- **Mapping**: All tickets map to the `incidentsandservice` table with `source = 'Freshdesk'`.
- **Categorization**: Automatically assigned to `L1 Support` via `TicketCategorizationService`.

---

## 3. Freshservice Integration

### Purpose
Captures internal service requests (L2/L4) and tracks escalations linked to development tickets.

### Core Components
- **Service**: `FreshserviceService.cs`
- **Base URL**: `https://{domain}.freshservice.com/api/v2`
- **Auth**: Basic Authentication using `apiKey:X` encoded in Base64.

### Configuration (.env)
```env
FRESHSERVICE_DOMAIN=your-domain.freshservice.com
FRESHSERVICE_API_KEY=your_api_key
FRESHSERVICE_ENABLED=true
```

### Key Logic
- **Linked Tickets**: Extends mapping to detect JIRA keys within the description or custom fields using `ExtractLinkedJiraTicket`.
- **Escalation Logic**: If it detects a linkage to a developer ticket or specific categories, it markers them as `L4` or `Awaiting L4`.
- **Mapping**: Maps to `incidentsandservice` table with `source = 'Freshservice'`.

---

## Data Synchronization Layer

### BackgroundSyncService.cs
A hosted background worker that runs every hour to keep local data fresh.

**Execution Order:**
1. **Freshservice Sync**: Updates recent L2/L4 tickets.
2. **Freshdesk Sync**: Updates recent L1 tickets.
3. **JIRA Sync**: Performs a deep sync of agile projects (Epics, Tickets, and Movements).

### Upsert Pattern (Idempotency)
The `DatabaseService` uses `INSERT ... ON CONFLICT (freshdesk_id/jira_key) DO UPDATE` to ensure that repeated syncs do not create duplicate records but instead update the status and timestamps of existing ones.

## Critical Constraints for Replication
- **Null Stripping**: Before database insertion, all string fields must be sanitized of null characters (`\0`) which are common in Freshworks descriptions but invalid in PostgreSQL.
- **Rate Limiting**: The system implements exponential backoff / wait-times when encountering HTTP `429 Too Many Requests` from Freshworks APIs.
- **Infinite Retention**: Per security policy, the `PurgeOldDataAsync` method is disabled to ensure 100% historical audit accuracy.
