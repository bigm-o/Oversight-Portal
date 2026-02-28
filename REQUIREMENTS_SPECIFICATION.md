# NIBSS Ticket Tracker - Requirements Specification Document

**Document Version**: 1.0  
**Date**: February 11, 2026  
**Prepared By**: Systems Architecture Team  
**Project**: NIBSS Governance & Oversight Ticket Tracking System

---

## EXECUTIVE SUMMARY

### Project Overview
The NIBSS Ticket Tracker is a centralized governance and oversight system designed to aggregate, monitor, and manage incidents and service requests from multiple support platforms (Freshservice L2 and Freshdesk L1). The system provides real-time visibility into ticket status, SLA compliance, and operational metrics for executive decision-making.

### Business Objectives
1. **Unified Visibility**: Single dashboard for all incidents and service requests across L1 and L2 support
2. **SLA Compliance**: Real-time monitoring and alerting for SLA breaches
3. **Data-Driven Decisions**: Executive metrics and KPIs for governance oversight
4. **Automated Synchronization**: Eliminate manual data collection and reporting
5. **Historical Tracking**: 7-day rolling window for trend analysis

### Key Stakeholders
- **Primary Users**: Executive Management, Governance Team, IT Leadership
- **Secondary Users**: Support Team Leads, Operations Managers
- **Data Sources**: Freshservice (L2 Support), Freshdesk (L1 Support)

---

## 1. SYSTEM ARCHITECTURE

### 1.1 Technology Stack

#### Backend
- **Framework**: ASP.NET Core 8.0 (C#)
- **Database**: PostgreSQL 15+
- **API Style**: RESTful
- **Authentication**: JWT (future), Basic Auth (current)
- **Background Jobs**: Quartz.NET for scheduled sync
- **HTTP Client**: IHttpClientFactory with named clients

#### Frontend
- **Framework**: React 18.3.1 with TypeScript
- **Build Tool**: Vite 6.3.5
- **Styling**: Tailwind CSS 4.1.12
- **UI Components**: Radix UI (accessible components)
- **HTTP Client**: Axios
- **Real-time**: SignalR (configured, not yet implemented)
- **Routing**: React Router 7.13.0
- **Charts**: Recharts

#### Infrastructure
- **Hosting**: Local/On-Premise (configurable for cloud)
- **Ports**: Backend (5000), Frontend (5173)
- **CORS**: Configured for local development

### 1.2 Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    NIBSS Ticket Tracker                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │   Frontend   │◄────────┤   Backend    │                  │
│  │  React + TS  │  HTTP   │  ASP.NET Core│                  │
│  └──────────────┘         └──────┬───────┘                  │
│                                   │                           │
│                          ┌────────▼────────┐                 │
│                          │   PostgreSQL    │                 │
│                          │    Database     │                 │
│                          └────────┬────────┘                 │
│                                   │                           │
└───────────────────────────────────┼───────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
            ┌───────▼────────┐           ┌─────────▼────────┐           ┌─────────▼────────┐
            │  Freshservice  │           │    Freshdesk     │           │      JIRA        │
            │  API (L2)      │           │    API (L1)      │           │  (Development)   │
            │  ✅ Active     │           │  ⚠️ Invalid Key  │           │  ⚠️ Auth Pending │
            └────────────────┘           └──────────────────┘           └──────────────────┘
```

---

## 2. FUNCTIONAL REQUIREMENTS

### 2.1 Data Synchronization

#### FR-2.1.1: Freshservice Integration (L2 Support)
**Priority**: Critical  
**Status**: ✅ Implemented

**Requirements**:
- System SHALL sync tickets from Freshservice API every 15 minutes
- System SHALL use `updated_since` parameter to fetch only tickets modified in last 7 days
- System SHALL handle pagination up to 20 pages (2000 tickets maximum)
- System SHALL respect rate limits (120 requests/minute)
- System SHALL map Freshservice fields to database schema
- System SHALL fetch agent names via separate API calls for `responder_id`
- System SHALL extract requester name and email from requester object
- System SHALL map source integers to human-readable channel names
- System SHALL clean descriptions by removing email signatures and HTML artifacts

**API Details**:
- **Endpoint**: `https://nibssplc.freshservice.com/api/v2/tickets`
- **Authentication**: Basic Auth (API Key: `qU6ZHt5e0764Cox4Ni8d`)
- **Method**: GET with query parameters

**Data Mapping**:
| Freshservice Field | Database Field | Transformation |
|-------------------|----------------|----------------|
| `id` | `freshdesk_id` | Direct |
| `subject` | `title` | Clean null bytes |
| `description` | `description` | Clean signatures + null bytes |
| `status` | `status` | Map: 2→0, 3→1, 4→2, 5→3, 6→1 |
| `priority` | `priority` | Map: 1→Low, 2→Medium, 3→High, 4→Urgent |
| `type` | `ticket_type` | Direct ("Incident" or "Service Request") |
| `source` | `channel` | Map to channel names |
| `due_by` | `sla_due_date` | Direct |
| `requester.name` | `requester` | Extract from object |
| `requester.email` | `requester_email` | Extract from object |
| `responder_id` | `assigned_to` | Fetch agent name via API |
| `created_at` | `created_at` | Direct |
| `updated_at` | `updated_at` | Direct |

**Business Rules**:
- Tickets with `type = "Service Request"` SHALL be categorized as L2 support
- Tickets with `type = "Incident"` SHALL be categorized as L2 incidents
- All Freshservice tickets SHALL have `support_level = "L2"`
- All Freshservice tickets SHALL have `source = "Freshservice"`

#### FR-2.1.2: Freshdesk Integration (L1 Support)
**Priority**: High  
**Status**: ⚠️ Blocked (Invalid API Key)

**Requirements**:
- System SHALL sync tickets from Freshdesk API every 15 minutes
- System SHALL use same sync strategy as Freshservice
- System SHALL categorize all Freshdesk tickets as L1 support
- System SHALL categorize all Freshdesk tickets as "Service Request" type
- All Freshdesk tickets SHALL have `support_level = "L1"`
- All Freshdesk tickets SHALL have `source = "Freshdesk"`

**API Details**:
- **Endpoint**: `https://nibssplccom.freshdesk.com/api/v2/tickets`
- **Authentication**: Basic Auth (API Key: `0wa0oa8P4LCV8FhOVS6` - INVALID)
- **Action Required**: Update API key to enable integration

#### FR-2.1.3: JIRA Integration (Development Tracker)
**Priority**: High  
**Status**: ⚠️ Auth Pending (Invalid/Expired Token)

**Requirements**:
- System SHALL sync development tickets from JIRA Cloud API
- System SHALL support Basic Authentication using email and API token
- System SHALL fetch issues using the `/rest/api/3/search/jql` endpoint
- System SHALL map JIRA fields (summary, status, assignee, etc.) to database schema
- System SHALL categorize JIRA tickets by project key
- System SHALL support real-time status updates via webhooks (Phase 5)

**API Details**:
- **Endpoint**: `https://nibss.atlassian.net/rest/api/3`
- **Authentication**: Basic Auth (Email + API Token)

#### FR-2.1.4: Upsert Logic
**Priority**: Critical  
**Status**: ✅ Implemented

**Requirements**:
- System SHALL check if ticket exists by `freshdesk_id` before inserting
- If ticket exists, system SHALL UPDATE all fields except `id` and `created_at`
- If ticket does not exist, system SHALL INSERT new record
- System SHALL handle concurrent updates gracefully
- System SHALL log sync operations with counts

#### FR-2.1.5: Data Cleanup
**Priority**: Critical  
**Status**: ✅ Implemented

**Requirements**:
- System SHALL delete tickets older than 7 days after each sync
- System SHALL use `created_at` field for age calculation
- System SHALL log number of deleted tickets
- Deletion SHALL occur after successful sync completion

#### FR-2.1.6: SLA Breach Detection
**Priority**: Critical  
**Status**: ✅ Implemented

**Requirements**:
- System SHALL copy `native_sla_due_date` to `sla_due_date` if `sla_due_date` is NULL
- System SHALL calculate `sla_breach = true` when `sla_due_date < NOW()`
- System SHALL update breach status on every cockpit request
- System SHALL update breach status after every sync
- System SHALL use UTC timezone for all comparisons

### 2.2 User Interface - Governance Cockpit

#### FR-2.2.1: Dashboard Metrics
**Priority**: Critical  
**Status**: ✅ Implemented

**Requirements**:
- System SHALL display 6 metric cards:
  1. **Open Incidents** (count + oldest date)
  2. **Open Service Requests** (count + oldest date)
  3. **In Progress** (count)
  4. **Critical Issues** (count)
  5. **Average Resolution Time** (hours)
  6. **SLA Breaches** (count)

**Calculations**:
- Open Incidents: `COUNT WHERE status IN (0,2) AND ticket_type = 'Incident'`
- Open Service Requests: `COUNT WHERE status IN (0,2) AND ticket_type = 'Service Request'`
- In Progress: `COUNT WHERE status IN (1,3)`
- Critical Issues: `COUNT WHERE priority IN ('Critical', 'Urgent')`
- Avg Resolution Time: `AVG(resolved_at - created_at) WHERE status IN (2,3)` in hours
- SLA Breaches: `COUNT WHERE sla_breach = true`

#### FR-2.2.2: Filtering System
**Priority**: High  
**Status**: ✅ Implemented

**Requirements**:
- System SHALL provide filters for:
  - **Search**: Free text search on title and description
  - **Type**: All, Incident, Service Request
  - **Support Level**: All, L1, L2
  - **Priority**: All, Critical, High, Medium, Low
  - **Status**: All, Open, In Progress, Resolved, Closed
  - **Date**: All Time, Today, Last 7 Days, Last 30 Days

- Filters SHALL be applied client-side for performance
- Filters SHALL be combinable (AND logic)
- Filter state SHALL persist during session

#### FR-2.2.3: Ticket List View
**Priority**: Critical  
**Status**: ✅ Implemented

**Requirements**:
- System SHALL display tickets in card format with:
  - Title (truncated if needed)
  - Ticket Type badge
  - Support Level badge
  - Status badge
  - Priority badge
  - SLA Breach badge (if breached)
  - Description preview (2 lines, 100 chars max)
  - Category, Requester, Assigned To, Channel
  - Created date
  - Ticket ID

**Visual Indicators**:
- Breached tickets SHALL have red border and red background
- Breach badge SHALL show "BREACHED - X days overdue"
- Priority SHALL be color-coded:
  - Critical: Red
  - High: Orange
  - Medium: Yellow
  - Low: Green

**Pagination**:
- System SHALL load 50 tickets initially
- System SHALL provide "Load More" button
- Button SHALL show remaining count

#### FR-2.2.4: Ticket Details Offcanvas
**Priority**: High  
**Status**: ✅ Implemented

**Requirements**:
- System SHALL open side panel when ticket is clicked
- Panel SHALL display:
  - Full title
  - Status & Priority section
  - SLA Information section (if SLA exists)
  - Request Details section
  - Timeline section
  - Full description (scrollable)

**SLA Information**:
- SLA Status: "At Risk" (red) or "On Track" (green)
- Progress bar: 100% if breached, 75% if on track
- Time Remaining: Calculate `sla_due_date - NOW()`
  - If breached: "X days overdue"
  - If not breached: "X days, Y hours"
  - If no SLA: "No SLA"

#### FR-2.2.5: Manual Sync Button
**Priority**: Medium  
**Status**: ✅ Implemented

**Requirements**:
- System SHALL provide "Sync from API" button
- Button SHALL show loading state during sync
- Button SHALL be disabled during sync
- System SHALL display success/error message after sync
- System SHALL refresh data after successful sync

#### FR-2.2.6: Create New Ticket
**Priority**: Medium  
**Status**: ✅ Implemented

**Requirements**:
- System SHALL provide "Create New" button
- System SHALL open modal with type selection (Incident vs Service Request)
- System SHALL collect:
  - Title (required)
  - Description
  - Priority (dropdown)
  - Category
  - Requester
  - Assigned To
  - Complexity (1-4)
  - Risk (1-4)

**Business Rules**:
- Delivery Points = (Complexity + Risk) × 5
- SLA Due Date calculated based on priority:
  - Critical: +4 hours
  - High: +24 hours
  - Medium: +72 hours
  - Low: +168 hours
- New tickets SHALL have `status = 0` (Open)
- New tickets SHALL have `source = "Freshdesk"`
- New tickets SHALL have `support_level = "L1"`

---

## 3. NON-FUNCTIONAL REQUIREMENTS

### 3.1 Performance

#### NFR-3.1.1: Response Time
- API endpoints SHALL respond within 2 seconds under normal load
- Database queries SHALL complete within 1 second
- Frontend SHALL render initial view within 3 seconds

#### NFR-3.1.2: Scalability
- System SHALL handle up to 10,000 tickets in database
- System SHALL support up to 50 concurrent users
- Sync process SHALL handle up to 2,000 tickets per run

#### NFR-3.1.3: Data Volume
- System SHALL maintain 7-day rolling window (approximately 6,000-8,000 tickets)
- System SHALL handle pagination for large result sets
- System SHALL optimize queries with proper indexing

### 3.2 Reliability

#### NFR-3.2.1: Availability
- System SHALL have 99% uptime during business hours (8 AM - 6 PM WAT)
- Scheduled maintenance SHALL occur outside business hours
- System SHALL recover from failures within 5 minutes

#### NFR-3.2.2: Data Integrity
- System SHALL prevent duplicate tickets (unique constraint on `freshdesk_id`)
- System SHALL handle API failures gracefully without data loss
- System SHALL log all sync operations for audit trail

#### NFR-3.2.3: Error Handling
- System SHALL retry failed API calls up to 3 times with exponential backoff
- System SHALL log all errors with stack traces
- System SHALL display user-friendly error messages

### 3.3 Security

#### NFR-3.3.1: Authentication
- API keys SHALL be stored in environment variables (not in code)
- System SHALL use HTTPS for all external API calls
- System SHALL implement JWT authentication (future phase)

#### NFR-3.3.2: Authorization
- System SHALL implement role-based access control (future phase)
- System SHALL restrict sensitive operations to authorized users

#### NFR-3.3.3: Data Protection
- System SHALL sanitize all user inputs
- System SHALL prevent SQL injection via parameterized queries
- System SHALL clean null bytes and malicious content from API data

### 3.4 Usability

#### NFR-3.4.1: User Experience
- UI SHALL be responsive (mobile, tablet, desktop)
- UI SHALL follow NIBSS branding guidelines
- UI SHALL provide visual feedback for all actions
- UI SHALL use accessible color contrasts (WCAG 2.1 AA)

#### NFR-3.4.2: Accessibility
- UI components SHALL be keyboard navigable
- UI SHALL support screen readers
- UI SHALL use semantic HTML

### 3.5 Maintainability

#### NFR-3.5.1: Code Quality
- Code SHALL follow C# and TypeScript best practices
- Code SHALL have meaningful variable and function names
- Code SHALL be modular and reusable

#### NFR-3.5.2: Documentation
- All API endpoints SHALL be documented in Swagger
- Database schema SHALL be documented
- Configuration options SHALL be documented in README

#### NFR-3.5.3: Logging
- System SHALL log all sync operations
- System SHALL log all errors with context
- Logs SHALL be rotated daily
- Log level SHALL be configurable (Info, Warning, Error)

---

## 4. DATA MODEL

### 4.1 Database Schema

#### Table: `incidentsandservice`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment ID |
| `freshdesk_id` | VARCHAR(50) | UNIQUE | External ticket ID |
| `title` | VARCHAR(500) | NOT NULL | Ticket title |
| `description` | TEXT | | Full description |
| `status` | INTEGER | NOT NULL | 0=Open, 1=Pending, 2=Resolved, 3=Closed |
| `priority` | VARCHAR(20) | | Low, Medium, High, Critical, Urgent |
| `category` | VARCHAR(100) | | Ticket category |
| `ticket_type` | VARCHAR(50) | | "Incident" or "Service Request" |
| `support_level` | VARCHAR(10) | | "L1" or "L2" |
| `source` | VARCHAR(50) | | "Freshservice" or "Freshdesk" |
| `requester` | VARCHAR(200) | | Requester name |
| `requester_email` | VARCHAR(200) | | Requester email |
| `assigned_to` | VARCHAR(200) | | Assigned agent name |
| `channel` | VARCHAR(50) | | Email, Portal, Phone, Chat, etc. |
| `sla_due_date` | TIMESTAMP | | SLA deadline |
| `native_sla_due_date` | TIMESTAMP | | Original SLA from API |
| `sla_breach` | BOOLEAN | DEFAULT false | Breach flag |
| `complexity` | INTEGER | | 1-4 complexity rating |
| `risk` | INTEGER | | 1-4 risk rating |
| `delivery_points` | INTEGER | | Calculated: (complexity + risk) × 5 |
| `created_at` | TIMESTAMP | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last update timestamp |

#### Indexes
- `idx_freshdesk_id` on `freshdesk_id` (unique)
- `idx_status` on `status`
- `idx_ticket_type` on `ticket_type`
- `idx_sla_breach` on `sla_breach`
- `idx_created_at` on `created_at`

---

## 5. API SPECIFICATIONS

### 5.1 Backend API Endpoints

#### GET /api/governance/cockpit
**Purpose**: Fetch all tickets and metrics  
**Authentication**: None (future: JWT)  
**Response**: 200 OK

```json
{
  "items": [...],
  "metrics": {
    "totalItems": 6116,
    "openItems": 150,
    "openIncidents": 25,
    "pendingItems": 80,
    "resolvedItems": 5800,
    "criticalItems": 15,
    "slaBreaches": 961,
    "atRiskItems": 45,
    "slaComplianceRate": 84.3
  },
  "slaAlerts": [...],
  "oldestTicketDate": "2026-02-04T10:30:00Z",
  "oldestIncidentDate": "2026-02-05T14:20:00Z"
}
```

#### POST /api/governance/sync
**Purpose**: Manually trigger sync  
**Authentication**: None (future: JWT)  
**Response**: 200 OK

```json
{
  "message": "Sync completed successfully"
}
```

#### POST /api/governance/update-sla-breaches
**Purpose**: Manually update SLA breach flags  
**Authentication**: None (future: JWT)  
**Response**: 200 OK

```json
{
  "message": "Updated all SLA breach statuses",
  "copiedSlaDates": 4466,
  "updatedBreachFlags": 6116
}
```

#### POST /api/governance/incidents
**Purpose**: Create new incident  
**Authentication**: None (future: JWT)  
**Request Body**:

```json
{
  "title": "System Outage",
  "description": "Production system down",
  "priority": "Critical",
  "category": "Infrastructure",
  "requester": "john.doe@nibss.com",
  "assignedTo": "IT Team",
  "complexity": 3,
  "risk": 4
}
```

**Response**: 201 Created

#### POST /api/governance/service-requests
**Purpose**: Create new service request  
**Authentication**: None (future: JWT)  
**Request Body**: Same as incidents  
**Response**: 201 Created

---

## 6. BUSINESS RULES

### 6.1 Ticket Categorization

#### BR-6.1.1: Support Level Assignment
- All tickets from Freshservice SHALL be L2
- All tickets from Freshdesk SHALL be L1
- Support level SHALL NOT be editable by users

#### BR-6.1.2: Ticket Type Assignment
- Freshservice tickets SHALL retain their original type (Incident or Service Request)
- Freshdesk tickets SHALL always be "Service Request"
- Manually created tickets SHALL specify type at creation

### 6.2 SLA Management

#### BR-6.2.1: SLA Calculation
- SLA due date SHALL be calculated from creation time + priority offset
- Priority offsets:
  - Critical: 4 hours
  - High: 24 hours
  - Medium: 72 hours
  - Low: 168 hours

#### BR-6.2.2: SLA Breach Detection
- Ticket SHALL be marked breached when `sla_due_date < current_time`
- Breach status SHALL be updated on every cockpit load
- Breach status SHALL be updated after every sync
- Breach calculation SHALL use UTC timezone

#### BR-6.2.3: SLA Data Synchronization
- If `sla_due_date` is NULL and `native_sla_due_date` exists, copy value
- This SHALL occur before breach detection
- This SHALL occur on every cockpit load and sync

### 6.3 Data Retention

#### BR-6.3.1: Rolling Window
- System SHALL maintain only last 7 days of tickets
- Age SHALL be calculated from `created_at` field
- Cleanup SHALL occur after each successful sync

#### BR-6.3.2: Historical Data
- Deleted tickets SHALL NOT be recoverable
- For long-term analytics, implement separate archival process (future phase)

### 6.4 Status Workflow

#### BR-6.4.1: Status Transitions
- Open (0) → In Progress (1) → Resolved (2) → Closed (3)
- Tickets MAY skip statuses (e.g., Open → Resolved)
- Status updates SHALL come from source systems (Freshservice/Freshdesk)

#### BR-6.4.2: Resolution Tracking
- Resolution time SHALL be calculated as `resolved_at - created_at`
- Only tickets with status Resolved (2) or Closed (3) SHALL count toward avg resolution time

---

## 7. INTEGRATION SPECIFICATIONS

### 7.1 Freshservice Integration

#### Sync Configuration
- **Interval**: 15 minutes (configurable via `FRESHSERVICE_SYNC_INTERVAL_MINUTES`)
- **Enabled**: Controlled by `FRESHSERVICE_ENABLED` flag
- **Timeframe**: Last 7 days using `updated_since` parameter
- **Pagination**: Max 20 pages, 100 tickets per page

#### Authentication
- **Method**: Basic Auth
- **Format**: `Authorization: Basic base64(api_key:X)`
- **Encoding**: ASCII (not UTF-8)
- **Header**: `Accept: application/json`

#### Rate Limiting
- **Limit**: 120 requests/minute
- **Handling**: Respect `Retry-After` header on 429 responses
- **Strategy**: Exponential backoff

#### Error Handling
- **Network Errors**: Retry up to 3 times
- **4xx Errors**: Log and skip ticket
- **5xx Errors**: Retry with backoff
- **Timeout**: 30 seconds per request

### 7.2 Freshdesk Integration

#### Current Status
- **Status**: Disabled (invalid API key)
- **Action Required**: Update `FRESHDESK_API_KEY` in .env file
- **Configuration**: Same as Freshservice once enabled

---

## 8. DEPLOYMENT REQUIREMENTS

### 8.1 Environment Variables

Required configuration in `.env` file:

```
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nibss_oversight
DB_USER=nibss_user
DB_PASSWORD=nibss_user_pass

# Freshservice
FRESHSERVICE_DOMAIN=nibssplc.freshservice.com
FRESHSERVICE_API_KEY=qU6ZHt5e0764Cox4Ni8d
FRESHSERVICE_SYNC_INTERVAL_MINUTES=15
FRESHSERVICE_ENABLED=true

# Freshdesk
FRESHDESK_DOMAIN=nibssplccom.freshdesk.com
FRESHDESK_API_KEY=[UPDATE_REQUIRED]
FRESHDESK_SYNC_INTERVAL_MINUTES=15
FRESHDESK_ENABLED=false

# Server
SERVER_PORT=5000
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

### 8.2 Database Setup

```sql
CREATE DATABASE nibss_oversight;
CREATE USER nibss_user WITH PASSWORD 'nibss_user_pass';
GRANT ALL PRIVILEGES ON DATABASE nibss_oversight TO nibss_user;
```

### 8.3 Startup Sequence

1. Start PostgreSQL database
2. Run database migrations (if any)
3. Start backend API (port 5000)
4. Start frontend dev server (port 5173)
5. Verify health endpoint: `GET /api/health`

---

## 9. TESTING REQUIREMENTS

### 9.1 Unit Testing
- Test all service methods
- Test data mapping functions
- Test SLA calculation logic
- Test breach detection logic

### 9.2 Integration Testing
- Test Freshservice API integration
- Test Freshdesk API integration (when key is fixed)
- Test database operations
- Test sync process end-to-end

### 9.3 UI Testing
- Test all filters
- Test pagination
- Test ticket details view
- Test create ticket flow
- Test responsive design

### 9.4 Performance Testing
- Load test with 10,000 tickets
- Test sync with 2,000 tickets
- Test concurrent user access
- Test database query performance

---

## 10. FUTURE ENHANCEMENTS

### Phase 2 Features

#### 10.1 Enhanced Data Fields
- Add requester phone number
- Add first response SLA tracking
- Add sub-category field
- Add group/team names
- Add department names

#### 10.2 Ticket History
- Implement conversations API integration
- Show full ticket timeline
- Track all status changes
- Show all comments and notes

#### 10.3 Time Tracking
- Integrate time entries API
- Track actual vs estimated time
- Show time spent per ticket
- Generate time reports

#### 10.4 Advanced Analytics
- Trend analysis charts
- Team performance metrics
- SLA compliance reports
- Custom date range filtering

#### 10.5 Notifications
- Real-time SignalR notifications
- Email alerts for SLA breaches
- Escalation notifications
- Daily summary reports

#### 10.6 Authentication & Authorization
- Implement JWT authentication
- Role-based access control
- User management
- Audit logging

#### 10.7 Custom Fields Integration
- Map NIBSS-specific custom fields
- Business impact tracking
- Downtime duration tracking
- Institution details
- Root cause analysis

---

## 11. ACCEPTANCE CRITERIA

### 11.1 Functional Acceptance

✅ **Data Synchronization**
- [ ] Freshservice tickets sync every 15 minutes
- [ ] Freshdesk tickets sync every 15 minutes (pending API key)
- [ ] Only last 7 days of tickets are retained
- [ ] Duplicate tickets are prevented
- [ ] SLA breach status is accurate

✅ **User Interface**
- [ ] Dashboard displays 6 metric cards with correct data
- [ ] All filters work correctly
- [ ] Pagination loads 50 tickets at a time
- [ ] Ticket details show complete information
- [ ] Breached tickets are highlighted in red
- [ ] Time remaining is calculated correctly

✅ **Performance**
- [ ] Cockpit loads within 3 seconds
- [ ] Sync completes within 2 minutes
- [ ] No memory leaks during extended operation

✅ **Reliability**
- [ ] System recovers from API failures
- [ ] No data loss during sync errors
- [ ] All operations are logged

### 11.2 Non-Functional Acceptance

✅ **Security**
- [ ] API keys are not exposed in code
- [ ] All inputs are sanitized
- [ ] SQL injection is prevented

✅ **Usability**
- [ ] UI is responsive on all devices
- [ ] Error messages are user-friendly
- [ ] Loading states are clear

✅ **Maintainability**
- [ ] Code follows best practices
- [ ] API is documented in Swagger
- [ ] Configuration is externalized

---

## 12. GLOSSARY

| Term | Definition |
|------|------------|
| **L1 Support** | Level 1 support (Freshdesk) - Basic helpdesk support |
| **L2 Support** | Level 2 support (Freshservice) - Advanced technical support |
| **SLA** | Service Level Agreement - Deadline for ticket resolution |
| **SLA Breach** | When current time exceeds SLA due date |
| **Cockpit** | Main dashboard view showing all tickets and metrics |
| **Upsert** | Update if exists, Insert if not exists |
| **Rolling Window** | Fixed time period that moves forward (7 days) |
| **Sync** | Synchronization process to fetch data from external APIs |

---

## DOCUMENT CONTROL

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-11 | Systems Architecture Team | Initial requirements specification |

**Approval**:
- [ ] Business Owner
- [ ] Technical Lead
- [ ] Project Manager

**Next Review Date**: 2026-03-11

---

**END OF DOCUMENT**
