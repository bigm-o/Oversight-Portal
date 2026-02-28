# Database Schema Documentation

This document provides a detailed overview of the database schema for the Ticket Tracker application. The database is hosted on PostgreSQL.

## Tables Overview

| Table Name | Description |
|------------|-------------|
| `users` | Stores user account information, roles, and permissions. |
| `agileteams` | Defines the different agile teams within the organization. |
| `projects` | Stores project details (Epics in JIRA context) and their metrics. |
| `tickets` | Individual development tasks and their current state. |
| `ticket_movements` | Audit trail of status changes for tickets. |
| `incidents` | Tracks critical incidents usually sourced from external systems. |
| `incidentsandservice` | Unified table for incidents and service requests (Freshdesk/Freshservice). |
| `jira_project_sources` | Mapping of JIRA project keys to internal teams for synchronization. |
| `invitations` | Tracks user registration invitations and their associated permissions. |

---

## 1. `users`
Stores user profile and authentication data.

| Column | Type | Description | Example Data |
|--------|------|-------------|--------------|
| `id` | `integer` | Primary Key (Serial) | `7` |
| `email` | `varchar(255)` | Unique user email | `tmaku@nibss-plc.com.ng` |
| `password_hash` | `varchar(255)` | BCrypt hashed password | `$2a$11$q2vB...` |
| `role` | `varchar(50)` | User role (Admin, Manager, Team Lead, Governor, User) | `User` |
| `first_name` | `text` | User's first name | `Toluwanimi` |
| `last_name` | `text` | User's last name | `Maku` |
| `permissions` | `jsonb` | Granular permission settings | `{"admin": true, "pages": [...], "teams": [1, 4]}` |
| `theme` | `varchar(10)` | UI Theme preference | `light` |
| `is_active` | `boolean` | Account status | `false` |
| `created_at` | `timestamp` | Record creation time | `2026-02-19 12:48:45` |

---

## 2. `agileteams`
Defines the structure of development teams.

| Column | Type | Description | Example Data |
|--------|------|-------------|--------------|
| `id` | `integer` | Primary Key (Serial) | `1` |
| `name` | `varchar(100)` | Team name | `Collections` |
| `lead` | `varchar(100)` | Team lead name | `Adebayo Oluwaseun` |
| `members` | `integer` | Count of team members | `12` |
| `active_sprint` | `varchar(50)` | Currently active sprint name | `Sprint 3` |
| `sprint_start` | `date` | Start date of active sprint | `2025-02-01` |
| `sprint_end` | `date` | End date of active sprint | `2025-02-14` |

---

## 3. `projects`
High-level initiatives or JIRA Epics.

| Column | Type | Description | Example Data |
|--------|------|-------------|--------------|
| `id` | `integer` | Primary Key (Serial) | `5` |
| `name` | `varchar(200)` | Project name | `BVN Verification Module` |
| `jira_key` | `text` | JIRA Epic/Project Key | `SKP-123` |
| `team_id` | `integer` | FK to `agileteams` | `3` |
| `status` | `text` | Current project status | `Active` |
| `start_date` | `date` | Project start date | `2026-01-26` |
| `target_date` | `date` | Goal completion date | `2026-03-27` |
| `total_tickets` | `integer` | Total tickets in project | `15` |
| `completed_tickets` | `integer` | Finished ticket count | `8` |
| `planned_points` | `integer` | Total delivery points | `90` |
| `completed_points` | `integer` | Points delivered so far | `45` |
| `lead` | `text` | Individual project lead | `John Doe` |

---

## 4. `tickets`
The core unit of development work.

| Column | Type | Description | Example Data |
|--------|------|-------------|--------------|
| `id` | `integer` | Primary Key (Serial) | `96` |
| `jira_key` | `text` | Unique JIRA key | `SKP-2788` |
| `epic_key` | `text` | Parent JIRA epic key | `SKP-2000` |
| `title` | `text` | Ticket summary | `(BE) Retrieve Split settlement details` |
| `status` | `integer` | Status Enum (0-8) | `7` |
| `complexity` | `integer` | Complexity Level (C1-C5) | `1` |
| `risk` | `integer` | Risk Level (R1-R5) | `1` |
| `delivery_points` | `integer` | Calculated delivery points | `10` |
| `project_id` | `integer` | FK to `projects` | `855` |
| `assigned_to` | `varchar(100)` | Developer username/email | `eonaolapo` |
| `jira_updated_at` | `timestamp` | Last update in JIRA | `2026-02-17 14:30:13` |
| `created_at` | `timestamp` | Record creation time | `2026-02-17 14:30:13` |

---

## 5. `ticket_movements`
The audit trail for ticket progression.

| Column | Type | Description | Example Data |
|--------|------|-------------|--------------|
| `id` | `integer` | Primary Key (Serial) | `1` |
| `ticket_id` | `integer` | FK to `tickets` | `27` |
| `jira_key` | `text` | Secondary JIRA key lookup | `SKP-2867` |
| `from_status` | `text` | Previous status name | `Backlog` |
| `to_status` | `text` | New status name | `In Progress` |
| `changed_by` | `text` | User who made the change | `Uriel Kasali` |
| `is_rollback` | `boolean` | Flag for backward movement | `false` |
| `created_at` | `timestamp` | When the change occurred | `2026-02-06 14:20:19` |

---

## 6. `incidentsandservice`
Unified tracking for support tickets.

| Column | Type | Description | Example Data |
|--------|------|-------------|--------------|
| `id` | `integer` | Primary Key (Serial) | `13678` |
| `freshdesk_id` | `varchar(50)` | External ID | `7008008` |
| `title` | `varchar(500)` | Ticket subject | `MERCHANT PROFILING ON NIBSS...` |
| `ticket_type` | `varchar(50)` | Incident or Service Request | `Service Request` |
| `status` | `integer` | Status Enum | `0` |
| `priority` | `varchar(20)` | High, Medium, Low | `High` |
| `team` | `varchar(100)` | Responsible internal team | `Contact Center` |
| `support_level` | `varchar(50)` | L1, L2, L3, L4 | `L1` |
| `delivery_points` | `integer` | Complexity weight | `5` |
| `sla_breach` | `boolean` | If SLA was violated | `false` |
| `source` | `varchar(50)` | Source system | `Freshdesk` |

---

## 7. `jira_project_sources`
Configuration for JIRA sync.

| Column | Type | Description | Example Data |
|--------|------|-------------|--------------|
| `jira_key` | `text` | Primary Key (Project Key) | `ABIC` |
| `jira_name` | `text` | JIRA Project Name | `All BVN Integration` |
| `category` | `text` | JIRA Category | `Certification` |
| `team_id` | `integer` | FK to `agileteams` | `1` |
| `last_synced_at` | `timestamp` | Last successful sync | `2026-02-20 09:41:03` |

---

## 8. `invitations`
User onboarding tracking.

| Column | Type | Description | Example Data |
|--------|------|-------------|--------------|
| `id` | `integer` | Primary Key (Serial) | `1` |
| `email` | `text` | Target user email | `user@example.com` |
| `token` | `text` | Unique secure token | `90cececc529a418...` |
| `role` | `varchar(50)` | Pre-assigned role | `Manager` |
| `permissions` | `jsonb` | Pre-assigned permissions | `{"admin": false, ...}` |
| `expires_at` | `timestamp` | Token validity deadline | `2026-02-21 12:15:44` |
| `is_used` | `boolean` | If invitation was accepted | `false` |

---

## 9. `incidents`
Historical/Legacy incident tracking (often merged or synced to `incidentsandservice`).

| Column | Type | Description | Example Data |
|--------|------|-------------|--------------|
| `id` | `integer` | Primary Key (Serial) | `1` |
| `freshdesk_id` | `varchar(50)` | External ID | `FD-12345` |
| `title` | `varchar(500)` | Incident title | `Core Banking API Timeout` |
| `status` | `integer` | Status code | `1` |
| `complexity` | `integer` | Weight | `3` |
| `sla_breach` | `boolean` | Breach flag | `true` |
| `category` | `varchar(100)` | Incident category | `System` |
| `priority` | `varchar(20)` | Urgency | `Critical` |
