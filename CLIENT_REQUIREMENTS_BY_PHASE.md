# Client Requirements & Actions by Phase

**Project**: NIBSS Ticket Tracker System  
**Purpose**: Detailed list of what you need to provide/do during each development phase  
**Created**: December 2024  

---

## PHASE 1: Project Foundation & Database Setup

### 1.1 Infrastructure & Environment Setup
**Your Actions Required**:

#### Database Environment
- [ ] **Provide PostgreSQL server details**:
  - Host/IP address and port
  - Database name (suggest: `nibss_ticket_tracker`)
  - Username/password with full admin privileges
  - SSL requirements (if any)
- [ ] **Confirm database version** (PostgreSQL 12+ recommended)
- [ ] **Provide backup/restore procedures** for your environment
- [ ] **Network access**: Ensure development machine can connect to database

#### Development Environment Access
- [ ] **Provide development server details** (if using shared server):
  - Server IP/hostname
  - SSH access credentials
  - Port configurations (5002 for backend, 3000 for frontend)
- [ ] **Firewall configurations**: Open required ports for development
- [ ] **SSL certificates** (if required for development environment)

#### Version Control
- [ ] **Set up Git repository**:
  - Create repository (GitHub/GitLab/Azure DevOps)
  - Provide repository URL and access credentials
  - Set up branching strategy (main, develop, feature branches)
- [ ] **Define code review process** and approvers

### 1.2 Configuration Data
**Your Actions Required**:
- [ ] **Provide sample team data**:
  - Team names, leads, member counts
  - Current sprint information
  - Active projects list
- [ ] **Define user roles and permissions**:
  - Admin users
  - CAB members
  - Regular users
  - IT Governance approvers

---

## PHASE 2: Core Models & Enums

### 2.1 Business Rules Validation
**Your Actions Required**:
- [ ] **Review and approve enum values**:
  - Confirm ticket status workflow (TODO → INPROGRESS → ... → LIVE)
  - Validate complexity levels (C1-C4 definitions)
  - Validate risk levels (R1-R4 definitions)
  - Approve priority mappings
- [ ] **Provide business rule documentation**:
  - When tickets can move between statuses
  - Who can approve status changes
  - Rollback conditions and triggers

### 2.2 Data Validation Rules
**Your Actions Required**:
- [ ] **Define validation rules**:
  - Required fields for each entity
  - Field length limits
  - Data format requirements
  - Business logic constraints
- [ ] **Approve database schema** before implementation

---

## PHASE 3: External System Integration Services

### 3.1 JIRA Integration Setup
**Your Actions Required**:

#### JIRA System Access
- [ ] **Provide JIRA instance details**:
  - JIRA base URL (e.g., https://nibss.atlassian.net)
  - JIRA version and edition
  - Available projects to sync
- [ ] **Set up OAuth 2.0 application in JIRA**:
  - Create OAuth app in JIRA admin
  - Provide Client ID and Client Secret
  - Configure callback URLs for token exchange
  - Set required permissions/scopes

#### JIRA Custom Fields Configuration
- [ ] **Configure Complexity custom field**:
  - Create custom field in JIRA
  - Set field type (Select List with C1, C2, C3, C4 options)
  - Apply to relevant issue types
  - Provide custom field ID
- [ ] **Configure Risk custom field**:
  - Create custom field in JIRA
  - Set field type (Select List with R1, R2, R3, R4 options)
  - Apply to relevant issue types
  - Provide custom field ID
- [ ] **Make fields mandatory** for ticket creation
- [ ] **Provide field mapping documentation**

#### JIRA Webhook Setup
- [ ] **Configure webhooks in JIRA**:
  - Set webhook URL (will be provided after backend deployment)
  - Configure events to monitor (issue created, updated, transitioned)
  - Set up webhook security (shared secret)
  - Test webhook delivery

#### JIRA Project Mapping
- [ ] **Provide project mapping**:
  - JIRA project keys to sync
  - Mapping to internal team structure
  - Issue types to include/exclude
  - Workflow status mappings

### 3.2 Freshdesk Integration Setup
**Your Actions Required**:

#### Freshdesk System Access
- [ ] **Provide Freshdesk instance details**:
  - Freshdesk domain (e.g., nibss.freshdesk.com)
  - Account type and plan
- [ ] **Generate API credentials**:
  - Create API key in Freshdesk admin
  - Provide API key and domain
  - Set required permissions for API access

#### Freshdesk Configuration
- [ ] **Configure custom fields for incidents**:
  - Add Complexity field (C1-C4)
  - Add Risk field (R1-R4)
  - Make fields mandatory for ticket creation
  - Provide custom field IDs
- [ ] **Set up SLA policies**:
  - Define SLA rules for different priorities
  - Configure escalation rules
  - Provide SLA calculation logic

#### Freshdesk Webhook Setup
- [ ] **Configure webhooks in Freshdesk**:
  - Set webhook URL (will be provided after backend deployment)
  - Configure events to monitor (ticket created, updated, resolved)
  - Test webhook delivery

### 3.3 Business Process Documentation
**Your Actions Required**:
- [ ] **Document CAB approval process**:
  - Who are CAB members
  - Approval criteria
  - Rejection handling process
- [ ] **Document governance approval process**:
  - Who can request complexity/risk changes
  - Who approves governance requests
  - Approval workflows and timelines
- [ ] **Define delivery points business rules**:
  - When points are locked
  - How to handle rejected CAB approvals
  - Incident impact calculation rules

---

## PHASE 4: Database Service Layer

### 4.1 Data Migration & Testing
**Your Actions Required**:
- [ ] **Provide test data**:
  - Sample JIRA tickets (export from current system)
  - Sample Freshdesk incidents
  - Historical data for testing (if available)
- [ ] **Define data retention policies**:
  - How long to keep audit logs
  - Archive policies for completed projects
  - Data purging requirements
- [ ] **Test database performance**:
  - Review query performance
  - Approve indexing strategy
  - Validate backup/restore procedures

---

## PHASE 5: Real-time Synchronization & Background Jobs

### 5.1 Synchronization Configuration
**Your Actions Required**:
- [ ] **Define sync schedules**:
  - Approve JIRA sync frequency (default: 5 minutes)
  - Approve Freshdesk sync frequency (default: 3 minutes)
  - Set maintenance windows for full sync
- [ ] **Configure monitoring**:
  - Set up alerts for sync failures
  - Define escalation procedures
  - Provide notification email addresses
- [ ] **Test webhook endpoints**:
  - Validate webhook security
  - Test real-time event processing
  - Confirm event filtering works correctly

### 5.2 Performance & Scaling
**Your Actions Required**:
- [ ] **Define performance requirements**:
  - Expected concurrent users
  - Response time requirements
  - Data volume expectations
- [ ] **Set up monitoring tools**:
  - Application performance monitoring
  - Database performance monitoring
  - Real-time connection monitoring

---

## PHASE 6: API Controllers

### 6.1 API Testing & Validation
**Your Actions Required**:
- [ ] **Test all API endpoints**:
  - Use Swagger UI to test each endpoint
  - Validate request/response formats
  - Test error handling scenarios
- [ ] **Validate business logic**:
  - Test delivery points calculations
  - Verify CAB approval workflows
  - Test governance approval processes
- [ ] **Security testing**:
  - Test authentication mechanisms
  - Validate authorization rules
  - Test API rate limiting

---

## PHASE 7: Frontend API Integration & Real-time Features

### 7.1 User Acceptance Testing
**Your Actions Required**:
- [ ] **Provide test users**:
  - Create test accounts for different roles
  - Provide user credentials for testing
  - Define user permission matrices
- [ ] **Test user workflows**:
  - Test executive dashboard functionality
  - Validate incident tracking features
  - Test development tracker workflows
  - Verify real-time notifications
- [ ] **UI/UX feedback**:
  - Review interface designs
  - Provide feedback on user experience
  - Request modifications if needed

### 7.2 Integration Testing
**Your Actions Required**:
- [ ] **End-to-end testing**:
  - Test complete workflows from JIRA to dashboard
  - Test Freshdesk incident flow
  - Validate delivery points calculations
  - Test CAB approval process
- [ ] **Performance testing**:
  - Test with realistic data volumes
  - Validate real-time update performance
  - Test concurrent user scenarios

---

## PHASE 8: Authentication & Authorization

### 8.1 User Management Setup
**Your Actions Required**:
- [ ] **Define user roles**:
  - Admin users and permissions
  - CAB members and permissions
  - Regular users and permissions
  - IT Governance approvers
- [ ] **Set up user accounts**:
  - Create initial admin accounts
  - Define password policies
  - Set up email domain restrictions (@nibss-plc.com.ng)
- [ ] **Test authentication**:
  - Test login/logout functionality
  - Validate role-based access
  - Test password reset procedures

---

## PHASE 9: Advanced Features & Optimization

### 9.1 Analytics & Reporting Validation
**Your Actions Required**:
- [ ] **Review analytics dashboards**:
  - Validate KPI calculations
  - Review trend analysis accuracy
  - Test export functionality
- [ ] **Define reporting requirements**:
  - Required report formats
  - Scheduled report delivery
  - Report distribution lists
- [ ] **Performance optimization approval**:
  - Review system performance
  - Approve caching strategies
  - Validate optimization results

---

## PHASE 10: Testing & Documentation

### 10.1 User Training & Documentation
**Your Actions Required**:
- [ ] **Review documentation**:
  - User manual accuracy
  - API documentation completeness
  - System administration guide
- [ ] **Conduct user training**:
  - Train admin users
  - Train CAB members
  - Train end users
  - Create training materials
- [ ] **Final acceptance testing**:
  - Complete system testing
  - Sign off on functionality
  - Approve for production deployment

---

## PHASE 11: Deployment & Production Setup

### 11.1 Production Environment Setup
**Your Actions Required**:
- [ ] **Provide production infrastructure**:
  - Production database server
  - Application server details
  - Load balancer configuration (if needed)
  - SSL certificates for production
- [ ] **Configure production external systems**:
  - Production JIRA OAuth credentials
  - Production Freshdesk API keys
  - Production webhook endpoints
- [ ] **Set up monitoring & alerting**:
  - Production monitoring tools
  - Alert notification channels
  - Escalation procedures
- [ ] **Backup & disaster recovery**:
  - Database backup procedures
  - Application backup strategies
  - Disaster recovery testing

### 11.2 Go-Live Support
**Your Actions Required**:
- [ ] **Go-live planning**:
  - Define go-live date and time
  - Plan user communication
  - Prepare rollback procedures
- [ ] **Post-deployment support**:
  - Monitor system performance
  - Address any immediate issues
  - Collect user feedback
  - Plan future enhancements

---

## ONGOING REQUIREMENTS

### Maintenance & Support
**Your Ongoing Responsibilities**:
- [ ] **System administration**:
  - User account management
  - Permission updates
  - System configuration changes
- [ ] **External system maintenance**:
  - JIRA/Freshdesk credential updates
  - Webhook endpoint maintenance
  - Custom field updates
- [ ] **Data governance**:
  - Audit log review
  - Data quality monitoring
  - Compliance reporting

### Change Management
**Your Process Requirements**:
- [ ] **Change approval process**:
  - Define change request procedures
  - Set up approval workflows
  - Document change impacts
- [ ] **Version control**:
  - Maintain system documentation
  - Track configuration changes
  - Manage deployment procedures

---

## CRITICAL SUCCESS FACTORS

### Before Starting Development
- [ ] **All external system access confirmed**
- [ ] **Database environment ready**
- [ ] **Custom fields configured in JIRA/Freshdesk**
- [ ] **Business rules documented and approved**
- [ ] **User roles and permissions defined**

### During Development
- [ ] **Regular testing and feedback**
- [ ] **Prompt response to questions and clarifications**
- [ ] **Timely approval of deliverables**
- [ ] **Active participation in testing phases**

### Before Go-Live
- [ ] **Complete user acceptance testing**
- [ ] **Production environment ready**
- [ ] **User training completed**
- [ ] **Support procedures in place**

---

**Document Owner**: Project Stakeholder  
**Last Updated**: December 2024  
**Next Review**: Before each phase begins