# NIBSS Ticket Tracker Backend

## Phase 1 Setup Complete ✅

### Database Schema
- **Location**: `backend/Database/schema.sql`
- **Tables Created**: 10 tables with relationships and indexes
- **Seed Data**: `backend/Database/seed-data.sql`

### .NET 8 API Project
- **Location**: `backend/TicketTracker.Api/`
- **Framework**: .NET 8 Web API
- **ORM**: Dapper for PostgreSQL

## Next Steps

### 1. Install .NET 8 SDK
Download and install from: https://dotnet.microsoft.com/download/dotnet/8.0

### 2. Run Database Scripts
Execute the following SQL scripts in your PostgreSQL database:
```bash
# Connect to your PostgreSQL database and run:
# 1. schema.sql (creates all tables, indexes, functions)
# 2. seed-data.sql (inserts sample data)
```

### 3. Restore NuGet Packages
```bash
cd backend/TicketTracker.Api
dotnet restore
```

### 4. Run the API
```bash
dotnet run
```

### 5. Test the API
- API will run on: `https://localhost:5002`
- Swagger UI: `https://localhost:5002`
- Health Check: `https://localhost:5002/api/health`

## Database Connection
The API is configured to connect to:
- **Host**: localhost
- **Port**: 5432
- **Database**: nibss_oversight
- **Username**: nibss_user
- **Password**: nibss_user_pass

## Features Implemented in Phase 1
- ✅ Complete database schema with 10 tables
- ✅ Delivery points calculation (automatic triggers)
- ✅ .NET 8 Web API project structure
- ✅ JWT authentication setup (placeholder)
- ✅ CORS configuration for frontend
- ✅ Swagger/OpenAPI documentation
- ✅ Serilog logging configuration
- ✅ External system configuration (JIRA/Freshdesk placeholders)
- ✅ Health check endpoints

## Ready for Phase 2
Once you have .NET 8 installed and the database scripts executed, we can proceed to Phase 2: Core Models & Enums.

## Database Schema Overview
1. **agileteams** - Team information
2. **projects** - Project tracking
3. **tickets** - JIRA ticket sync with delivery points
4. **incidents** - Freshdesk incident sync
5. **tickethistory** - Audit trail
6. **auditlogs** - Universal logging
7. **deliveryaggregation** - Project delivery metrics
8. **externalsystemconfig** - JIRA/Freshdesk config
9. **webhookevents** - Real-time event tracking
10. **governanceapprovals** - Approval workflows

## Delivery Points Formula
- **Development Tasks**: DP = 10 × (Complexity + Risk)
- **Incidents**: DP = 5 × (Complexity + Risk)
- **Scale**: C1/R1=1, C2/R2=2, C3/R3=3, C4/R4=4