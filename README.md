# NIBSS Oversight Portal 🛡️

A premium Enterprise Intelligence & Governance system designed for NIBSS (Nigeria Inter-Bank Settlement System). This portal provides a unified interface for tracking JIRA delivery metrics, Freshservice incidents, and automated SLA compliance reporting.

## 🚀 Key Modules
- **NIBSS GPT**: A high-speed, multi-agent AI engine specialized in governance, development operations, and service delivery.
- **Incident Cockpit**: Real-time tracking of L1-L4 incidents and service requests with automated SLA breach detection.
- **Development Tracker**: Agile velocity monitoring and delivery points (DP) calculation with JIRA synchronization.
- **Governance Layer**: Secure CAB (Change Advisory Board) approval workflows and automated audit logging.

## 🛠️ Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Motion (Framer), Radix UI.
- **Backend**: .NET 8 Web API, Dapper ORM.
- **Database**: PostgreSQL with Full-Text Search and Vector-ready schema.
- **External APIs**: JIRA v3 API, Freshservice v2 API, Gemini 1.5 Flash (AI Engine).

## 📊 Business Logic & Formulae
### Delivery Points (DP)
The system automatically calculates individual and team performance based on:
- **Dev Tasks**: `DP = 10 × (Complexity + Risk)`
- **Incidents**: `DP = 5 × (Complexity + Risk)`

## 📦 Getting Started

### Prerequisites
- .NET 8 SDK
- Node.js (v18+)
- PostgreSQL 16+

### Installation
1. **Database Setup**
   ```bash
   psql -U postgres -f backend/Database/schema.sql
   ```

2. **Backend Services**
   ```bash
   cd backend/TicketTracker.Api
   dotnet build
   dotnet run
   ```

3. **Frontend Application**
   ```bash
   cd "frontend/Nibss Tracker UI"
   npm install
   npm run dev
   ```

## 📖 Governance Policy
This system maintains 100% data retention for auditing purposes. All manual overrides and governance approvals are cryptographically signed and logged.

---
*Secured by the NIBSS Governance Framework.*
