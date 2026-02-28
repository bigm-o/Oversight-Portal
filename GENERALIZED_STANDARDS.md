# Technical Standards & Development Guidelines

## 0. AI Assistant Guidelines
- **Problem-Solving Approach**: Analyze and discover root causes. Outline findings. Provide options and recommended approaches where appropriate.
- **Change Approval**: Seek explicit approval before making any changes

## 0.1 CARDINAL RULES - CHANGE AUTHORIZATION

### 🚨 MANDATORY AUTHORIZATION PROTOCOL 🚨

**BEFORE making ANY changes, you MUST:**

1. **ASK FOR EXPLICIT AUTHORIZATION** from the project owner
2. **DESCRIBE the exact change** you intend to make
3. **WARN about ANY potential to break existing functionality**
4. **WAIT for explicit "yes" or approval** before proceeding

### What Requires Authorization (ALL changes):
- ✋ Code changes (frontend, backend, configuration)
- ✋ Database changes (schema, data, queries)
- ✋ File operations (create, modify, delete)
- ✋ Dependency updates (packages, libraries)
- ✋ Environment configuration changes
- ✋ Deployment or infrastructure changes

### Breaking Change Warning Required:
If a change has ANY potential to:
- Break existing functionality
- Change data formats or structures
- Affect other components or systems
- Require additional testing or validation
- Impact users or production systems

**YOU MUST explicitly warn the owner and get approval.**

### Violation Consequences:
- Unauthorized changes will be immediately reverted
- Breaking changes without warning are unacceptable
- This rule supersedes ALL other guidelines

**NO EXCEPTIONS. NO ASSUMPTIONS. ALWAYS ASK FIRST.**

## 1. Database Standards

### 1.1 Schema Design
- **Single Source of Truth**: All dynamic data MUST come from the primary database
- **No Static Data**: Frontend components MUST NOT contain hardcoded business data
- **Enum Consistency**: Database enums MUST match backend application enums exactly
- **Required Fields**: All entities MUST have standardized audit fields (`id`, `created_at`, etc.)
- **Naming Convention**: Use consistent naming conventions across all database objects

### 1.2 Data Migration
- **Additive Changes**: New columns MUST use safe addition patterns (`ADD COLUMN IF NOT EXISTS`)
- **Backward Compatibility**: Schema changes MUST not break existing data
- **Seeding**: Initial data seeding MUST check for existing records before insertion
- **Upsert Pattern**: Use conflict resolution patterns for idempotent operations

### 1.3 Data Management
- **Metadata Flags**: Use boolean flags to indicate data relationships and states
- **Category Mapping**: Use consistent enum integers for categorization
- **Status Priority**: Define clear priority ordering for status fields
- **Array Storage**: Use appropriate array storage patterns for multi-value fields

## 2. Backend Standards

### 2.1 Architecture
- **ORM Choice**: Use lightweight ORM solutions for performance-critical applications
- **Service Layer**: Database operations MUST go through dedicated service layers
- **Controller Responsibility**: Controllers handle HTTP concerns only, delegate to services
- **Error Handling**: All database operations MUST have comprehensive error handling

### 2.2 API Design
- **RESTful Endpoints**: Follow REST conventions for resource operations
- **Status Codes**: Use appropriate HTTP status codes consistently
- **JSON Serialization**: Use proper serialization patterns for complex types
- **CORS Configuration**: Configure CORS appropriately for each environment

### 2.3 Static File Serving
- **Documentation Files**: Store API specifications in designated static directories
- **File Naming**: Use descriptive names that match resource identifiers
- **Format Standards**: Maintain consistent file formats for documentation

### 2.4 Authentication & Authorization
- **Token-Based Auth**: Use stateless authentication mechanisms
- **Role Claims**: Include user roles in authentication tokens for frontend authorization
- **Domain Restrictions**: Implement domain-based access controls where appropriate
- **Password Security**: Use industry-standard password hashing algorithms

## 3. Frontend Standards

### 3.1 Data Fetching
- **API First**: Always attempt to fetch from backend APIs first
- **Error Handling**: Display meaningful error messages when API calls fail
- **No Mixed Sources**: NEVER mix database and static data in the same component
- **Loading States**: Show appropriate loading indicators during async operations

### 3.2 Component Architecture
- **Component Reuse**: ALWAYS prioritize reusing existing components before creating new ones
- **Single Responsibility**: Each component should have one clear purpose
- **State Management**: Use appropriate state management patterns for application scale
- **Data Flow**: Follow unidirectional data flow patterns
- **Error Boundaries**: Handle component errors gracefully

### 3.3 Routing & Navigation
- **Declarative Routing**: Use framework-appropriate routing solutions with protected routes
- **URL Structure**: Follow RESTful URL patterns for consistency
- **Navigation State**: Provide clear navigation state feedback
- **Deep Linking**: All pages should be directly accessible via URL

### 3.4 Styling Standards
- **CSS Classes**: Use semantic class names, avoid inline styles except for dynamic values
- **Responsive Design**: Mobile-first approach with proper breakpoints
- **Design System**: Use consistent design tokens and variables
- **Typography**: Maintain consistent typography scales across components

## 4. API Documentation Standards

### 4.1 Specification Format
- **Standard Format**: Use industry-standard API specification formats (OpenAPI 3.0+)
- **Complete Schemas**: Include request/response schemas for all endpoints
- **Examples**: Provide realistic examples for requests and responses
- **Rich Descriptions**: Use markup formatting in descriptions for enhanced readability

### 4.2 Documentation Structure
- **Logical Organization**: Group endpoints by functional categories
- **Parameter Documentation**: Document all parameters with types and constraints
- **Error Responses**: Document all possible error responses with examples
- **Security Schemes**: Define authentication requirements clearly

### 4.3 File Management
- **Organized Storage**: Store documentation files in logical directory structures
- **Consistent Formats**: Use consistent file formats and extensions
- **Descriptive Naming**: Use naming conventions that match functionality
- **Version Control**: Include documentation files in source control

## 5. Security Standards

### 5.1 Authentication
- **Password Policies**: Enforce strong password requirements
- **Session Management**: Use secure token management with appropriate expiration
- **Role-Based Access**: Implement proper role checking on both frontend and backend
- **Identity Verification**: Validate user identity through appropriate mechanisms

### 5.2 Data Protection
- **Input Validation**: Validate all user inputs on both client and server
- **Injection Prevention**: Use parameterized queries and prepared statements
- **XSS Prevention**: Sanitize user-generated content appropriately
- **Access Control**: Implement proper access control policies

### 5.3 API Security
- **Rate Limiting**: Implement rate limiting for API endpoints
- **Authentication Headers**: Require valid authentication for protected endpoints
- **Environment Separation**: Enforce proper environment isolation
- **Audit Logging**: Log all critical user actions for compliance

### 5.4 Audit Logging Requirements
- **Comprehensive Tracking**: ALL user actions MUST be logged appropriately
- **Required Fields**: Every audit log MUST contain user, context, action, and timestamp
- **Real-time Logging**: Actions MUST be logged immediately when performed
- **Scalable Storage**: Use dedicated audit storage with proper indexing
- **Data Retention**: Define and implement appropriate retention policies
- **Privacy Compliance**: Log actions but NOT sensitive data content
- **Performance Optimization**: Implement efficient logging patterns to minimize performance impact

## 6. Development Workflow

### 6.1 Environment Setup
- **Local Development**: Establish consistent local development environments
- **Port Configuration**: Use standardized port assignments across team
- **Environment Variables**: Use configuration files for environment-specific settings
- **Dependency Management**: Keep dependency files updated and synchronized

### 6.2 Code Quality
- **Error Handling**: All async operations MUST have proper error handling
- **Logging**: Use structured logging for debugging and monitoring
- **Code Comments**: Comment complex business logic, avoid obvious comments
- **Consistent Formatting**: Use consistent code formatting and naming conventions

### 6.3 Testing Strategy
- **Integration Testing**: Test with real system connections where appropriate
- **API Testing**: Test all endpoints with various input scenarios
- **User Interface Testing**: Test user interactions and error states
- **End-to-End Testing**: Test complete user workflows

## 7. Deployment Standards

### 7.1 Environment Configuration
- **Development**: Local setup with containerized services where appropriate
- **Staging**: Mirror production configuration for accurate testing
- **Production**: Secure configuration with proper secrets management
- **Configuration Management**: Use environment-specific configuration patterns

### 7.2 Database Deployment
- **Migration Scripts**: All schema changes through versioned migration scripts
- **Data Seeding**: Automated seeding for initial data setup
- **Backup Strategy**: Regular database backups with tested retention policies
- **Connection Management**: Configure appropriate connection pooling and limits

### 7.3 Static Assets
- **Asset Deployment**: Deploy static assets with application releases
- **Build Optimization**: Use optimized build processes for frontend assets
- **CDN Strategy**: Consider content delivery networks for static assets in production
- **Caching Strategy**: Implement appropriate caching headers for static content

## 8. Monitoring & Maintenance

### 8.1 Health Checks
- **Status Endpoints**: Implement health check endpoints for monitoring
- **System Connectivity**: Monitor critical system connections
- **Application Metrics**: Track response times and error rates
- **User Activity**: Monitor user engagement and feature usage patterns

### 8.2 Error Tracking
- **Structured Logging**: Use consistent log formats across all components
- **Error Aggregation**: Collect and analyze application errors systematically
- **Performance Monitoring**: Track slow operations and system bottlenecks
- **User Feedback**: Provide mechanisms for user issue reporting

### 8.3 Data Management
- **Regular Backups**: Implement automated backup procedures
- **Data Retention**: Define and implement retention policies for different data types
- **Performance Optimization**: Regular system maintenance and optimization
- **Capacity Planning**: Monitor growth patterns and plan for scaling needs

## 9. Compliance & Governance

### 9.1 Data Governance
- **Data Classification**: Classify data by sensitivity and access requirements
- **Access Controls**: Implement appropriate data access restrictions
- **Audit Requirements**: Maintain audit trails for compliance purposes
- **Privacy Protection**: Follow applicable data protection regulations

### 9.2 Change Management
- **Version Control**: All changes through source control with descriptive commit messages
- **Code Reviews**: Implement peer review processes for all code changes
- **Documentation Synchronization**: Keep documentation synchronized with code changes
- **Release Documentation**: Document all changes for stakeholders

### 9.3 Business Continuity
- **Disaster Recovery**: Establish system recovery procedures
- **Backup Verification**: Regular testing of backup and restore procedures
- **Incident Response**: Define procedures for handling system issues
- **Communication Plans**: Establish stakeholder communication protocols for incidents

---

**Document Purpose**: Technical standards template for software development projects  
**Customization Required**: Adapt technology choices, naming conventions, and specific requirements to your project  
**Review Frequency**: Regular review and updates based on project evolution  
**Governance**: Establish clear ownership and approval processes for standards updates