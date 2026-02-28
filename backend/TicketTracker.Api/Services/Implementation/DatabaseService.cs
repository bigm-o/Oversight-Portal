using Dapper;
using Npgsql;
using TicketTracker.Api.Models.Entities;
using TicketTracker.Api.Models.DTOs;
using Auth = TicketTracker.Api.Models.Auth;
using TicketTracker.Api.Services.Interfaces;

namespace TicketTracker.Api.Services.Implementation;

public class DatabaseService : IDatabaseService
{
    private readonly string _connectionString;
    private readonly IConfiguration _configuration;
    private readonly ILogger<DatabaseService> _logger;

    public DatabaseService(IConfiguration configuration, ILogger<DatabaseService> logger)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection") 
            ?? throw new ArgumentNullException("DefaultConnection not found");
        _configuration = configuration;
        _logger = logger;
    }

    private async Task<NpgsqlConnection> GetConnectionAsync()
    {
        var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync();
        return connection;
    }

    public async Task<bool> TestConnectionAsync()
    {
        try
        {
            using var connection = await GetConnectionAsync();
            await connection.QueryAsync("SELECT 1");
            _logger.LogInformation("Database connection test successful");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Database connection test failed");
            return false;
        }
    }

    // Ticket operations
    public async Task<List<Ticket>> GetTicketsAsync(DateTime? startDate = null, DateTime? endDate = null)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            
            var conditions = new List<string>();
            var p = new DynamicParameters();

            if (startDate.HasValue)
            {
                conditions.Add("t.created_at >= @StartDate");
                p.Add("StartDate", startDate.Value);
            }
            if (endDate.HasValue)
            {
                conditions.Add("t.created_at < @EndDateLimit");
                p.Add("EndDateLimit", endDate.Value.AddDays(1));
            }
            if (!startDate.HasValue && !endDate.HasValue)
            {
                conditions.Add("t.created_at >= @Horizon");
                p.Add("Horizon", new DateTime(DateTime.UtcNow.Year - 1, 1, 1));
            }

            var whereClause = conditions.Count > 0 ? "WHERE " + string.Join(" AND ", conditions) : "";

            var sql = $@"
                SELECT t.id AS Id, t.jira_key AS JiraKey, t.title AS Title, t.status AS Status, t.complexity AS Complexity, t.risk AS Risk, 
                       t.delivery_points AS DeliveryPoints, t.project_id AS ProjectId, 
                       t.assigned_to AS AssignedTo, t.created_at AS CreatedAt, t.updated_at AS UpdatedAt,
                       t.description AS Description, t.cab_approved AS CabApproved, 
                       t.cab_rejection_reason AS CabRejectionReason,
                       t.points_locked AS PointsLocked, t.jira_updated_at AS JiraUpdatedAt,
                       t.epic_key AS EpicKey, tm.name AS Team
                FROM tickets t
                LEFT JOIN projects p ON t.project_id = p.id
                LEFT JOIN teams tm ON p.team_id = tm.id
                {whereClause}
                ORDER BY t.created_at DESC";

            var tickets = await connection.QueryAsync<Ticket>(sql, p);
            return tickets.ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving tickets");
            return new List<Ticket>();
        }
    }

    public async Task<Ticket?> GetTicketByIdAsync(int id)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = @"
                SELECT id AS Id, jira_key AS JiraKey, title AS Title, description AS Description, 
                       status AS Status, complexity AS Complexity, risk AS Risk, 
                       delivery_points AS DeliveryPoints, cab_approved AS CabApproved, 
                       cab_rejection_reason AS CabRejectionReason, points_locked AS PointsLocked,
                       project_id AS ProjectId, assigned_to AS AssignedTo, 
                       jira_updated_at AS JiraUpdatedAt, created_at AS CreatedAt, 
                       updated_at AS UpdatedAt, epic_key AS EpicKey
                FROM tickets 
                WHERE id = @Id";
            
            return await connection.QueryFirstOrDefaultAsync<Ticket>(sql, new { Id = id });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving ticket {TicketId}", id);
            return null;
        }
    }

    public async Task<Ticket?> GetTicketByJiraKeyAsync(string jiraKey)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = @"
                SELECT id AS Id, jira_key AS JiraKey, title AS Title, description AS Description, 
                       status AS Status, complexity AS Complexity, risk AS Risk, 
                       delivery_points AS DeliveryPoints, cab_approved AS CabApproved, 
                       cab_rejection_reason AS CabRejectionReason, points_locked AS PointsLocked,
                       project_id AS ProjectId, assigned_to AS AssignedTo, 
                       jira_updated_at AS JiraUpdatedAt, created_at AS CreatedAt, 
                       updated_at AS UpdatedAt, epic_key AS EpicKey, is_manual_project_map AS IsManualProjectMap
                FROM tickets 
                WHERE jira_key = @JiraKey";
            
            return await connection.QueryFirstOrDefaultAsync<Ticket>(sql, new { JiraKey = jiraKey });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving ticket {JiraKey}", jiraKey);
            return null;
        }
    }

    public async Task<int> CreateTicketAsync(Ticket ticket)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = @"
                INSERT INTO tickets (jira_key, title, description, status, complexity, risk, 
                                   delivery_points, cab_approved, cab_rejection_reason, points_locked,
                                   project_id, assigned_to, jira_updated_at, created_at, updated_at, epic_key, is_manual_project_map)
                VALUES (@JiraKey, @Title, @Description, @Status, @Complexity, @Risk,
                        @DeliveryPoints, @CabApproved, @CabRejectionReason, @PointsLocked,
                        @ProjectId, @AssignedTo, @JiraUpdatedAt, @CreatedAt, @UpdatedAt, @EpicKey, @IsManualProjectMap)
                RETURNING id";
            
            if (ticket.CreatedAt == default)
                ticket.CreatedAt = DateTime.UtcNow;
            
            if (ticket.UpdatedAt == default)
                ticket.UpdatedAt = DateTime.UtcNow;
            
            var id = await connection.QuerySingleAsync<int>(sql, ticket);
            _logger.LogInformation("Created ticket {TicketId} with JIRA key {JiraKey}", id, ticket.JiraKey);
            return id;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating ticket {JiraKey}", ticket.JiraKey);
            return 0;
        }
    }

    public async Task<bool> UpdateTicketAsync(Ticket ticket)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = @"
                UPDATE tickets 
                SET title = @Title, description = @Description, status = @Status,
                    complexity = @Complexity, risk = @Risk, delivery_points = @DeliveryPoints,
                    cab_approved = @CabApproved, cab_rejection_reason = @CabRejectionReason,
                    points_locked = @PointsLocked, assigned_to = @AssignedTo,
                    project_id = @ProjectId, is_manual_project_map = @IsManualProjectMap,
                    jira_updated_at = @JiraUpdatedAt, updated_at = @UpdatedAt, epic_key = @EpicKey
                WHERE id = @Id";
            
            if (ticket.UpdatedAt == default)
                ticket.UpdatedAt = DateTime.UtcNow;
            
            var rowsAffected = await connection.ExecuteAsync(sql, ticket);
            _logger.LogInformation("Updated ticket {TicketId}", ticket.Id);
            return rowsAffected > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating ticket {TicketId}", ticket.Id);
            return false;
        }
    }

    public async Task<bool> DeleteTicketAsync(int id)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = "DELETE FROM tickets WHERE id = @Id";
            
            var rowsAffected = await connection.ExecuteAsync(sql, new { Id = id });
            _logger.LogInformation("Deleted ticket {TicketId}", id);
            return rowsAffected > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting ticket {TicketId}", id);
            return false;
        }
    }

    public async Task<List<Ticket>> GetUnmappedTicketsAsync()
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = @"
                SELECT id AS Id, jira_key AS JiraKey, title AS Title, status AS Status, complexity AS Complexity, risk AS Risk, 
                       delivery_points AS DeliveryPoints, project_id AS ProjectId, 
                       assigned_to AS AssignedTo, created_at AS CreatedAt,
                       description AS Description, cab_approved AS CabApproved, 
                       cab_rejection_reason AS CabRejectionReason,
                       points_locked AS PointsLocked, jira_updated_at AS JiraUpdatedAt,
                       epic_key AS EpicKey, is_manual_project_map AS IsManualProjectMap
                FROM tickets 
                WHERE project_id IS NULL
                ORDER BY created_at DESC";
            
            var tickets = await connection.QueryAsync<Ticket>(sql);
            return tickets.ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving unmapped tickets");
            return new List<Ticket>();
        }
    }

    public async Task<bool> UpdateTicketProjectAsync(int ticketId, int? projectId)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = "UPDATE tickets SET project_id = @ProjectId, is_manual_project_map = TRUE, updated_at = NOW() WHERE id = @Id";
            var affected = await connection.ExecuteAsync(sql, new { Id = ticketId, ProjectId = projectId });
            return affected > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating ticket project mapping for ticket {Id}", ticketId);
            return false;
        }
    }

    public async Task<List<SprintBoardTicket>> GetSprintBoardTicketsAsync(int teamId)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = @"
                SELECT id AS Id, team_id AS TeamId, jira_key AS JiraKey, title AS Title, 
                       status AS Status, assigned_to AS AssignedTo, delivery_points AS DeliveryPoints,
                       board_type AS BoardType, is_rollback AS IsRollback,
                       created_at AS CreatedAt, updated_at AS UpdatedAt
                FROM sprint_board_tickets
                WHERE team_id = @TeamId
                ORDER BY updated_at DESC";
            var result = await connection.QueryAsync<SprintBoardTicket>(sql, new { TeamId = teamId });
            return result.ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting sprint board tickets for team {TeamId}", teamId);
            return new List<SprintBoardTicket>();
        }
    }

    public async Task<Dictionary<int, int>> GetSprintTicketCountsAsync()
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = "SELECT team_id as TeamId, COUNT(*) as TicketCount FROM sprint_board_tickets GROUP BY team_id";
            var result = await connection.QueryAsync<TeamSprintCountResult>(sql);
            
            return result.ToDictionary(
                x => x.TeamId,
                x => (int)x.TicketCount
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting sprint ticket counts");
            return new Dictionary<int, int>();
        }
    }

    private class TeamSprintCountResult
    {
        public int TeamId { get; set; }
        public long TicketCount { get; set; }
    }

    public async Task ReplaceSprintBoardTicketsAsync(int teamId, List<SprintBoardTicket> tickets)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            using var transaction = await connection.BeginTransactionAsync();
            
            // Delete old tickets for this team
            await connection.ExecuteAsync("DELETE FROM sprint_board_tickets WHERE team_id = @TeamId", new { TeamId = teamId }, transaction);
            
            // Insert new tickets
            if (tickets != null && tickets.Any())
            {
                var sql = @"
                    INSERT INTO sprint_board_tickets (team_id, jira_key, title, status, assigned_to, delivery_points, board_type, is_rollback, updated_at)
                    VALUES (@TeamId, @JiraKey, @Title, @Status, @AssignedTo, @DeliveryPoints, @BoardType, @IsRollback, @UpdatedAt)";
                await connection.ExecuteAsync(sql, tickets, transaction);
            }
            
            await transaction.CommitAsync();
            _logger.LogInformation("Replaced sprint board tickets for team {TeamId}. Count: {Count}", teamId, tickets?.Count ?? 0);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error replacing sprint board tickets for team {TeamId}", teamId);
        }
    }


    public async Task<int> CreateTicketMovementAsync(TicketMovement movement)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = @"
                INSERT INTO ticket_movements (ticket_id, jira_key, from_status, to_status, changed_by, reason, justification, created_at, is_rollback)
                VALUES (@TicketId, @JiraKey, @FromStatus, @ToStatus, @ChangedBy, @Reason, @Justification, @CreatedAt, @IsRollback)
                RETURNING id;
            ";
            return await connection.ExecuteScalarAsync<int>(sql, movement);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating ticket movement for {JiraKey}", movement.JiraKey);
            return 0;
        }
    }


    // Incident operations (Pointed to incidentsandservice after legacy incidents table deletion)
    public async Task<List<Incident>> GetIncidentsAsync()
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = $@"
                SELECT 
                    id, 
                    freshdesk_id as FreshdeskId, 
                    title, 
                    CASE 
                        WHEN status = 2 THEN 0 -- OPEN
                        WHEN status = 3 THEN 1 -- PENDING
                        WHEN status = 4 THEN 2 -- RESOLVED
                        WHEN status = 5 THEN 3 -- CLOSED
                        ELSE 0 
                    END as Status,
                    complexity as Complexity, 
                    risk as Risk,
                    created_at as CreatedAt
                FROM incidentsandservice 
                WHERE created_at >= @Horizon
                ORDER BY created_at DESC
                LIMIT 100";
            
            var horizon = new DateTime(DateTime.UtcNow.Year, 1, 1);
            var incidents = await connection.QueryAsync<Incident>(sql, new { Horizon = horizon });
            return incidents.ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving incidents from incidentsandservice");
            return new List<Incident>();
        }
    }

    public async Task<Incident?> GetIncidentByIdAsync(int id)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = @"
                SELECT 
                    id, 
                    freshdesk_id as FreshdeskId, 
                    title, 
                    description, 
                    CASE 
                        WHEN status = 2 THEN 0 -- OPEN
                        WHEN status = 3 THEN 1 -- PENDING
                        WHEN status = 4 THEN 2 -- RESOLVED
                        WHEN status = 5 THEN 3 -- CLOSED
                        ELSE 0 
                    END as Status,
                    complexity as Complexity, 
                    risk as Risk,
                    delivery_points as DeliveryPoints, 
                    0 as Priority, -- Default for legacy model
                    0 as TeamId,    -- Default for legacy model
                    assigned_to as AssignedTo, 
                    freshdesk_updated_at as FreshdeskUpdatedAt,
                    created_at as CreatedAt, 
                    updated_at as UpdatedAt
                FROM incidentsandservice 
                WHERE id = @Id";
            
            return await connection.QueryFirstOrDefaultAsync<Incident>(sql, new { Id = id });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving incident {IncidentId} from incidentsandservice", id);
            return null;
        }
    }

    public async Task<int> CreateIncidentAsync(Incident incident)
    {
        _logger.LogWarning("CreateIncidentAsync called but legacy incidents table is deleted. Use Sync instead.");
        return await Task.FromResult(0);
    }

    public async Task<bool> UpdateIncidentAsync(Incident incident)
    {
        _logger.LogWarning("UpdateIncidentAsync called but legacy incidents table is deleted. Use Sync instead.");
        return await Task.FromResult(false);
    }

    // Project operations
    public async Task<int> UpsertProjectAsync(Project project)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            
            // Query for existing project with this JIRA key (only if key is provided and not just whitespace)
            int? existingId = null;
            if (!string.IsNullOrWhiteSpace(project.JiraKey))
            {
                var sqlCheck = "SELECT id FROM projects WHERE jira_key = @JiraKey";
                existingId = await connection.QueryFirstOrDefaultAsync<int?>(sqlCheck, new { JiraKey = project.JiraKey });
            }
            
            // For manual projects, ensure JiraKey is null if empty string
            if (string.IsNullOrWhiteSpace(project.JiraKey))
            {
                project.JiraKey = null;
            }
            
            if (existingId.HasValue)
            {
                // Update
                project.Id = existingId.Value;
                _logger.LogInformation("Updating existing project {Id} ({Name})", project.Id, project.Name);
                var sqlUpdate = @"
                    UPDATE projects 
                    SET name = @Name, 
                        team_id = @TeamId, 
                        start_date = COALESCE(@StartDate, start_date, CURRENT_DATE), 
                        target_date = COALESCE(@TargetDate, target_date, (CURRENT_DATE + '30 days'::interval)), 
                        status = COALESCE(@Status, status, 'Active'), 
                        description = COALESCE(@Description, description, ''),
                        lead = COALESCE(@Lead, lead, '')
                    WHERE id = @Id
                    RETURNING id";
                
                return await connection.ExecuteScalarAsync<int>(sqlUpdate, project);
            }
            else
            {
                // Insert
                _logger.LogInformation("Creating new project: {Name} for Team {TeamId}. Manual: {IsManual}", 
                    project.Name, project.TeamId, string.IsNullOrWhiteSpace(project.JiraKey));
                
                var sqlInsert = @"
                    INSERT INTO projects (jira_key, name, team_id, start_date, target_date, status, description, lead)
                    VALUES (
                        @JiraKey, @Name, @TeamId, 
                        COALESCE(@StartDate, CURRENT_DATE), 
                        COALESCE(@TargetDate, (CURRENT_DATE + '30 days'::interval)), 
                        COALESCE(@Status, 'Active'), 
                        COALESCE(@Description, ''), 
                        COALESCE(@Lead, '')
                    )
                    RETURNING id";
                
                var newId = await connection.ExecuteScalarAsync<int>(sqlInsert, project);
                _logger.LogInformation("Successfully created project {Name} with ID {Id}", project.Name, newId);
                return newId;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error upserting project {Name} (Key: {JiraKey})", project.Name, project.JiraKey);
            return 0;
        }
    }

    public async Task<Project?> GetProjectByJiraKeyAsync(string jiraKey)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = "SELECT id AS Id, jira_key AS JiraKey, name AS Name, team_id AS TeamId, start_date AS StartDate, target_date AS TargetDate, status AS Status, description AS Description, lead AS Lead FROM projects WHERE jira_key = @JiraKey";
            return await connection.QueryFirstOrDefaultAsync<Project>(sql, new { JiraKey = jiraKey });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving project {JiraKey}", jiraKey);
            return null;
        }
    }

    public async Task<List<Project>> GetAllProjectsAsync()
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = "SELECT id AS Id, jira_key AS JiraKey, name AS Name, team_id AS TeamId, start_date AS StartDate, target_date AS TargetDate, status AS Status, description AS Description, lead AS Lead FROM projects";
            var projects = await connection.QueryAsync<Project>(sql);
            return projects.ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving all projects");
            return new List<Project>();
        }
    }

    public async Task<Project?> GetProjectByIdAsync(int id)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = "SELECT id AS Id, jira_key AS JiraKey, name AS Name, team_id AS TeamId, start_date AS StartDate, target_date AS TargetDate, status AS Status, description AS Description, lead AS Lead FROM projects WHERE id = @Id";
            return await connection.QueryFirstOrDefaultAsync<Project>(sql, new { Id = id });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving project {Id}", id);
            return null;
        }
    }

    public async Task<List<dynamic>> GetAllProjectsWithMetricsAsync(bool includeEmpty = false)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = $@"
                SELECT 
                    p.id AS ""Id"", 
                    p.jira_key AS ""JiraKey"", 
                    p.name AS ""Name"", 
                    p.team_id AS ""TeamId"", 
                    p.start_date AS ""StartDate"", 
                    p.target_date AS ""TargetDate"", 
                    p.status AS ""Status"", 
                    p.description AS ""Description"", 
                    p.lead AS ""Lead"",
                    COUNT(t.id) AS ""TotalTickets"",
                    COUNT(CASE WHEN t.project_id IS NOT NULL AND (t.epic_key IS NULL OR t.epic_key = '') THEN 1 END) AS ""ManualMappingCount"",
                    COUNT(CASE WHEN t.status = 7 THEN 1 END) AS ""CompletedTickets"",
                    COALESCE(SUM(t.delivery_points), 0) AS ""PlannedPoints"",
                    COALESCE(SUM(CASE WHEN t.status = 7 THEN t.delivery_points ELSE 0 END), 0) AS ""CompletedPoints"",
                    COUNT(CASE WHEN t.status != 7 AND t.status != 8 AND (NOW() - t.created_at) > INTERVAL '14 days' THEN 1 END) AS ""SlaBreaches"",
                    COUNT(CASE WHEN t.status != 7 AND t.status != 8 AND (NOW() - t.updated_at) > INTERVAL '7 days' THEN 1 END) AS ""StaleTickets""
                FROM projects p
                LEFT JOIN tickets t ON t.project_id = p.id
                GROUP BY p.id
                {(includeEmpty ? "" : "HAVING COUNT(t.id) > 0 OR p.jira_key IS NULL OR p.jira_key = ''")}
                ORDER BY COUNT(t.id) DESC, p.id DESC";
            
            var result = await connection.QueryAsync(sql);
            return result.ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving projects with metrics");
            return new List<dynamic>();
        }
    }

    public async Task<bool> UpdateProjectAsync(Project project)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = @"
                UPDATE projects 
                SET name = @Name, team_id = @TeamId, start_date = @StartDate, 
                    target_date = @TargetDate, status = @Status, description = @Description,
                    lead = @Lead
                WHERE id = @Id";
            
            return await connection.ExecuteAsync(sql, project) > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating project {Id}", project.Id);
            return false;
        }
    }

    public async Task<bool> DeleteProjectAsync(int id)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            
            // Safety check: ensure no tickets are mapped to this project
            var hasTickets = await connection.ExecuteScalarAsync<bool>(
                "SELECT EXISTS(SELECT 1 FROM tickets WHERE project_id = @Id)", 
                new { Id = id });
            
            if (hasTickets) return false;

            var result = await connection.ExecuteAsync("DELETE FROM projects WHERE id = @Id", new { Id = id });
            return result > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting project {Id}", id);
            return false;
        }
    }

    // Delivery aggregation operations (placeholder)
    public async Task<DeliveryAggregation?> GetDeliveryAggregationAsync(int projectId)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = @"
                SELECT id, projectid, totaldeliverypoints, completeddeliverypoints,
                       efficiencypercentage, lastcalculated, createdat, updatedat
                FROM deliveryaggregation 
                WHERE projectid = @ProjectId";
            
            return await connection.QueryFirstOrDefaultAsync<DeliveryAggregation>(sql, new { ProjectId = projectId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving delivery aggregation for project {ProjectId}", projectId);
            return null;
        }
    }

    public async Task<bool> UpdateDeliveryAggregationAsync(DeliveryAggregation aggregation)
    {
        // TODO: Implement delivery aggregation update
        _logger.LogInformation("Delivery aggregation update - to be implemented");
        return await Task.FromResult(true);
    }

    public async Task RecalculateProjectDeliveryPointsAsync(int projectId)
    {
        // TODO: Implement project delivery points recalculation
        _logger.LogInformation("Project delivery points recalculation for project {ProjectId} - to be implemented", projectId);
        await Task.CompletedTask;
    }

    // Governance operations (placeholder)
    public async Task<List<GovernanceApproval>> GetPendingApprovalsAsync()
    {
        // TODO: Implement pending approvals retrieval
        _logger.LogInformation("Pending approvals retrieval - to be implemented");
        return await Task.FromResult(new List<GovernanceApproval>());
    }

    public async Task<int> CreateGovernanceApprovalAsync(GovernanceApproval approval)
    {
        // TODO: Implement governance approval creation
        _logger.LogInformation("Governance approval creation - to be implemented");
        return await Task.FromResult(1);
    }

    public async Task<bool> UpdateGovernanceApprovalAsync(GovernanceApproval approval)
    {
        // TODO: Implement governance approval update
        _logger.LogInformation("Governance approval update - to be implemented");
        return await Task.FromResult(true);
    }

    // Service Request operations
    public async Task<List<ServiceRequest>> GetServiceRequestsAsync(string? source = null, bool? escalatedOnly = null, string? team = null, string? institution = null, string? priority = null, DateTime? startDate = null, DateTime? endDate = null, string? level = null, string? fromLevel = null, string? toLevel = null)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = @"
                SELECT 
                    id AS Id, 
                    title AS Title, 
                    description AS Description, 
                    freshdesk_id AS FreshdeskId, 
                    status AS Status, 
                    priority AS Priority, 
                    category AS Category,
                    requester AS Requester, 
                    requester_email AS RequesterEmail, 
                    assigned_to AS AssignedTo, 
                    channel AS Channel, 
                    complexity AS Complexity, 
                    risk AS Risk,
                    delivery_points AS DeliveryPoints, 
                    sla_due_date AS SlaDueDate, 
                    native_sla_due_date AS NativeSlaDueDate, 
                    sla_breach AS SlaBreach,
                    ticket_type AS TicketType, 
                    support_level AS SupportLevel, 
                    source AS Source, 
                    team AS Team, 
                    institution AS Institution,
                    linked_ticket_id AS LinkedTicketId,
                    linked_ticket_source AS LinkedTicketSource, 
                    escalation_status AS EscalationStatus, 
                    created_at AS CreatedAt, 
                    updated_at AS UpdatedAt,
                    resolved_at AS ResolvedAt, 
                    freshdesk_updated_at AS FreshdeskUpdatedAt
                FROM incidentsandservice 
                WHERE 1=1";
            
            var parameters = new DynamicParameters();

            if (!string.IsNullOrEmpty(source))
            {
                sql += " AND source = @Source";
                parameters.Add("Source", source);
            }

            if (!string.IsNullOrEmpty(team) && team != "All Teams")
            {
                sql += " AND team = @Team";
                parameters.Add("Team", team);
            }

            if (!string.IsNullOrEmpty(institution) && institution != "All Institutions")
            {
                sql += " AND institution = @Institution";
                parameters.Add("Institution", institution);
            }

            if (!string.IsNullOrEmpty(priority) && priority != "All Priorities")
            {
                sql += " AND priority = @Priority";
                parameters.Add("Priority", priority);
            }

            if (startDate.HasValue)
            {
                sql += " AND created_at >= @StartDate";
                parameters.Add("StartDate", startDate.Value.Date);
            }

            if (endDate.HasValue)
            {
                // Include up to the end of the day
                sql += " AND created_at < @EndDate";
                parameters.Add("EndDate", endDate.Value.Date.AddDays(1));
            }
            // Level filtering
            if (!string.IsNullOrEmpty(level) && level != "All Levels")
            {
                sql += " AND support_level = @Level";
                parameters.Add("Level", level);
            }
            // From/To level range filtering
            if (!string.IsNullOrEmpty(fromLevel) && fromLevel != "All Levels")
            {
                sql += " AND support_level >= @FromLevel";
                parameters.Add("FromLevel", fromLevel);
            }
            if (!string.IsNullOrEmpty(toLevel) && toLevel != "All Levels")
            {
                sql += " AND support_level <= @ToLevel";
                parameters.Add("ToLevel", toLevel);
            }

            if (escalatedOnly == true)
            {
                // Only show tickets that have actual recorded movements in the movement table
                sql += @" AND EXISTS (
                    SELECT 1 FROM service_request_movements m 
                    WHERE m.service_request_id = incidentsandservice.id
                )";
            }

            sql += " ORDER BY created_at DESC";
            var tickets = await connection.QueryAsync<ServiceRequest>(sql, parameters);
            return tickets.ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving service requests");
            return new List<ServiceRequest>();
        }
    }

    public async Task<bool> SyncDevelopmentIncidentsAsync()
    {
        try
        {
            // --- Config ---
            var fsDomain = _configuration["FRESHSERVICE_DOMAIN"] ?? "";
            var fsApiKey = _configuration["FRESHSERVICE_API_KEY"] ?? "";
            var jiraBaseUrl = (_configuration["JIRA_BASE_URL"] ?? "https://nibss.atlassian.net") + "/rest/api/3";
            var jiraToken = _configuration["JIRA_API_TOKEN"] ?? "";
            var jiraEmail = _configuration["JIRA_EMAIL"] ?? _configuration["JIRA_USER_EMAIL"] ?? "";

            if (string.IsNullOrEmpty(fsDomain) || string.IsNullOrEmpty(fsApiKey))
            {
                _logger.LogError("FRESHSERVICE_DOMAIN or FRESHSERVICE_API_KEY not configured");
                return false;
            }
            _logger.LogInformation("Using Freshservice Domain: {Domain}", fsDomain);
            _logger.LogInformation("Using Freshservice API Key (masked): {MaskedKey}", fsApiKey.Substring(0, Math.Min(4, fsApiKey.Length)) + new string('*', Math.Max(0, fsApiKey.Length - 4)));

            var fsAuth = Convert.ToBase64String(System.Text.Encoding.ASCII.GetBytes($"{fsApiKey}:X"));
            var jiraAuthBytes = System.Text.Encoding.ASCII.GetBytes($"{jiraEmail}:{jiraToken}");
            var jiraAuth = Convert.ToBase64String(jiraAuthBytes);

            using var httpClient = new System.Net.Http.HttpClient();
            httpClient.Timeout = TimeSpan.FromSeconds(30);

            // --- Build JIRA project → team mapping from DB ---
            using var connection = await GetConnectionAsync();
            var projectTeamMap = (await connection.QueryAsync<(string jiraKey, string teamName)>(
                @"SELECT p.jira_key, t.name as teamName 
                  FROM projects p 
                  JOIN teams t ON p.team_id = t.id 
                  WHERE p.jira_key IS NOT NULL AND p.jira_key != ''"))
                .GroupBy(x => x.jiraKey.Split('-')[0].ToUpperInvariant())
                .Select(g => (prefix: g.Key, teamName: g.First().teamName))
                .ToDictionary(x => x.prefix, x => x.teamName, StringComparer.OrdinalIgnoreCase);

            _logger.LogInformation("Built JIRA project→team map with {Count} prefixes: {Keys}", 
                projectTeamMap.Count, string.Join(", ", projectTeamMap.Keys));

            // --- Step 0: Normalize old team names from the legacy sync script ---
            var teamNameAliases = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "Core Switching and Processing", "Core Switching" },
                { "Application Support", "Collections" },
                { "DATA & IDENTITY", "Data & Identity" },
                { "Identity DevOps", "Data & Identity" },
                { "PAYMENT", "Collections" },
                { "NDD", "Collections" },
            };
            foreach (var alias in teamNameAliases)
            {
                await connection.ExecuteAsync(
                    "UPDATE development_incidents SET team = @NewTeam WHERE TRIM(team) = @OldTeam",
                    new { OldTeam = alias.Key, NewTeam = alias.Value });
            }

            // Also trim all team names in DB
            await connection.ExecuteAsync("UPDATE development_incidents SET team = TRIM(team) WHERE team != TRIM(team)");
            var l4Tickets = new List<System.Text.Json.JsonElement>();
            // Get L4 tickets directly from FS API
            for (int page = 1; page <= 50; page++)
            {
                var fsUrl = $"https://{fsDomain}/api/v2/tickets?page={page}&per_page=100&include=requester,custom_fields";
                var fsReq = new System.Net.Http.HttpRequestMessage(System.Net.Http.HttpMethod.Get, fsUrl);
                fsReq.Headers.Add("Authorization", $"Basic {fsAuth}");

                var fsResp = await httpClient.SendAsync(fsReq);
                if (!fsResp.IsSuccessStatusCode) {
                    _logger.LogWarning("Freshservice API failed with {Status} on page {Page}", fsResp.StatusCode, page);
                    break;
                }

                var fsContent = await fsResp.Content.ReadAsStringAsync();
                var fsDoc = System.Text.Json.JsonDocument.Parse(fsContent);
                
                if (!fsDoc.RootElement.TryGetProperty("tickets", out var ticketArr)) {
                    _logger.LogWarning("Freshservice response missing 'tickets' property on page {Page}", page);
                    break;
                }
                
                var pageTickets = ticketArr.EnumerateArray().ToList();
                if (pageTickets.Count == 0) break;

                _logger.LogInformation("Page {Page} from Freshservice: {Count} total tickets", page, pageTickets.Count);

                var l4OnPage = pageTickets.Where(t => {
                    var status = t.TryGetProperty("status", out var s) ? s.GetInt32() : 0;
                    return status == 18;
                }).ToList();
                
                if (l4OnPage.Count > 0)
                {
                    _logger.LogInformation("Found {Count} L4 tickets (status 18) on page {Page}", l4OnPage.Count, page);
                    l4Tickets.AddRange(l4OnPage);
                }

                if (pageTickets.Count < 100) break;
            }

            // Pull tickets from local cache that are specifically L4 status (18)
            var l4FromMainTable = await connection.QueryAsync<dynamic>(
                "SELECT freshdesk_id as id, title, description, status, priority, created_at, updated_at, team, linked_ticket_id as jira_key FROM incidentsandservice WHERE status = 18");
            
            var processedIds = new HashSet<string>(l4Tickets.Select(t => t.GetProperty("id").GetInt64().ToString()));
            
            // Add those from DB that weren't in the API page filter (e.g. they are L4 by group but not status 18)
            foreach (var dbTicket in l4FromMainTable)
            {
                string idStr = dbTicket.id.ToString();
                if (!processedIds.Contains(idStr))
                {
                    // Create a synthetic JSON element or just handle them separately.
                    // For simplicity, we'll just add the IDs to the active list for the cleanup step below
                    processedIds.Add(idStr);
                    // Note: We don't add them to l4Tickets list here to avoid complex JsonElement mocking, 
                    // but we ensure they aren't marked as 'Resolved' in Step 2.
                }
            }

            _logger.LogInformation("Found {Count} L4 tickets total after merging API and DB sources", processedIds.Count);

            // --- Step 2: Mark previously Awaiting L4 tickets that no longer are ---
            await connection.ExecuteAsync(@"
                UPDATE development_incidents 
                SET freshservice_status = 'Resolved/Closed', updated_at = @Now
                WHERE freshservice_status NOT IN ('Resolved/Closed', 'Resolved', 'Closed')
                  AND freshservice_id NOT IN (SELECT unnest(@ActiveIds::varchar[]))",
                new { Now = DateTime.UtcNow, ActiveIds = processedIds.ToArray() });

            // --- Step 3: Upsert each L4 ticket ---
            int synced = 0;
            var jiraCache = new Dictionary<string, (string key, string status, string assignee, string projectPrefix)>();

            // Convert l4Tickets into a common format for processing
            var allL4ToProcess = new List<L4TicketSource>();
            foreach (var t in l4Tickets) {
                allL4ToProcess.Add(new L4TicketSource {
                    Id = t.GetProperty("id").GetInt64().ToString(),
                    Subject = t.TryGetProperty("subject", out var s) ? s.GetString() ?? "" : "",
                    Description = t.TryGetProperty("description_text", out var d) ? d.GetString() ?? "" : "",
                    Priority = t.TryGetProperty("priority", out var p) ? p.GetInt32() : 2,
                    Status = t.TryGetProperty("status", out var st) ? st.GetInt32() : 0,
                    CreatedAt = t.TryGetProperty("created_at", out var ca) ? ca.GetDateTime() : DateTime.UtcNow,
                    UpdatedAt = t.TryGetProperty("updated_at", out var ua) ? ua.GetDateTime() : DateTime.UtcNow,
                    CustomFields = t.TryGetProperty("custom_fields", out var cf) && cf.ValueKind == System.Text.Json.JsonValueKind.Object 
                        ? System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(cf.GetRawText()) 
                        : null
                });
            }
            // Add those from main table that weren't in the API list
            var apiIds = new HashSet<string>(allL4ToProcess.Select(x => x.Id));
            foreach (var dbT in l4FromMainTable) {
                string id = dbT.id.ToString();
                if (!apiIds.Contains(id)) {
                    allL4ToProcess.Add(new L4TicketSource {
                        Id = dbT.id.ToString(),
                        Subject = dbT.title ?? "",
                        Description = dbT.description ?? "",
                        Priority = dbT.priority is int p ? p : 2,
                        Status = dbT.status is int s ? s : 18,
                        CreatedAt = dbT.created_at is DateTime ca ? ca : DateTime.UtcNow,
                        UpdatedAt = dbT.updated_at is DateTime ua ? ua : DateTime.UtcNow,
                        Team = dbT.team ?? "Unknown",
                        JiraKey = dbT.jira_key
                    });
                }
            }

            foreach (var ticket in allL4ToProcess)
            {
                var fsId = ticket.Id;
                var subject = ticket.Subject;
                var description = ticket.Description;
                var priority = ticket.Priority;
                var createdAt = ticket.CreatedAt;
                var updatedAt = ticket.UpdatedAt;
                var priorityText = priority switch { 4 => "Urgent", 3 => "High", 2 => "Medium", _ => "Low" };

                string? jiraKey = ticket.JiraKey;
                string teamName = ticket.Team;
                string jiraStatus = "Awaiting Link";
                string jiraAssignee = "Unassigned";

                // If already categorized as Developers or another known team, we're good
                if (teamName != "Unknown" && teamName != "Unassigned")
                {
                    // If we have a JIRA key, let's try to get its status/assignee 
                    if (!string.IsNullOrEmpty(jiraKey))
                    {
                        var j = await LookupJiraIssue(httpClient, jiraBaseUrl, jiraAuth, $"key = \"{jiraKey}\"");
                        jiraStatus = j.status;
                        jiraAssignee = j.assignee;
                    }
                }
                else
                {
                    var falsePositives = new HashSet<string> { "UTF-8", "API-9", "TLS-1", "ISO-20", "UTF-16", "TLS-12" };
                    var jiraKeyRegex = new System.Text.RegularExpressions.Regex(@"\b([A-Z]{2,10}-\d+)\b");

                    // Log custom fields for diagnostics
                    if (ticket.CustomFields != null)
                    {
                        _logger.LogInformation("FS#{FsId} Custom Fields: {Fields}", fsId, string.Join(", ", ticket.CustomFields.Keys));
                    }

                    // Strategy 0: Extract from custom field
                    string? extractedKey = null;
                    var jiraField = _configuration["TicketCategorization:JiraLinkingField"];
                    if (!string.IsNullOrEmpty(jiraField) && ticket.CustomFields != null && ticket.CustomFields.ContainsKey(jiraField))
                    {
                        extractedKey = ticket.CustomFields[jiraField]?.ToString();
                    }

                    // Strategy 1: Extract JIRA key from ticket subject + description (if not found in custom field)
                    if (string.IsNullOrEmpty(extractedKey))
                    {
                        var textToSearch = subject + " " + description;
                        foreach (System.Text.RegularExpressions.Match m in jiraKeyRegex.Matches(textToSearch))
                        {
                            var candidate = m.Groups[1].Value;
                            if (!falsePositives.Contains(candidate) && projectTeamMap.ContainsKey(candidate.Split('-')[0]))
                            {
                                extractedKey = candidate;
                                break;
                            }
                        }
                    }

                    if (extractedKey != null)
                    {
                        if (!jiraCache.TryGetValue(extractedKey, out var cached))
                        {
                            cached = await LookupJiraIssue(httpClient, jiraBaseUrl, jiraAuth, $"issuekey = \"{extractedKey}\"");
                            jiraCache[extractedKey] = cached;
                        }
                        if (cached.key != null)
                        {
                            jiraKey = cached.key;
                            jiraStatus = cached.status;
                            jiraAssignee = cached.assignee;
                            teamName = ResolveTeamFromJiraPrefix(cached.projectPrefix, projectTeamMap);
                        }
                    }

                    // Strategy 2: Scan ticket conversations/notes for JIRA keys
                    if (teamName == "Unknown")
                    {
                        try
                        {
                            var convUrl = $"https://{fsDomain}/api/v2/tickets/{fsId}/conversations";
                            var convReq = new System.Net.Http.HttpRequestMessage(System.Net.Http.HttpMethod.Get, convUrl);
                            convReq.Headers.Add("Authorization", $"Basic {fsAuth}");
                            var convResp = await httpClient.SendAsync(convReq);
                            if (convResp.IsSuccessStatusCode)
                            {
                                var convContent = await convResp.Content.ReadAsStringAsync();
                                var convDoc = System.Text.Json.JsonDocument.Parse(convContent);
                                if (convDoc.RootElement.TryGetProperty("conversations", out var convArr))
                                {
                                    foreach (var conv in convDoc.RootElement.GetProperty("conversations").EnumerateArray())
                                    {
                                        var body = conv.TryGetProperty("body_text", out var bt) ? bt.GetString() ?? "" : "";
                                        foreach (System.Text.RegularExpressions.Match m in jiraKeyRegex.Matches(body))
                                        {
                                            var candidate = m.Groups[1].Value;
                                            if (!falsePositives.Contains(candidate) && projectTeamMap.ContainsKey(candidate.Split('-')[0]))
                                            {
                                                var convResult = await LookupJiraIssue(httpClient, jiraBaseUrl, jiraAuth, $"issuekey = \"{candidate}\"");
                                                if (convResult.key != null)
                                                {
                                                    jiraKey = convResult.key;
                                                    jiraStatus = convResult.status;
                                                    jiraAssignee = convResult.assignee;
                                                    teamName = ResolveTeamFromJiraPrefix(convResult.projectPrefix, projectTeamMap);
                                                    break;
                                                }
                                            }
                                        }
                                        if (teamName != "Unknown") break;
                                    }
                                }
                            }
                        }
                        catch (Exception ex) { _logger.LogWarning(ex, "Failed scanning conversations for FS#{FsId}", fsId); }
                    }

                    // Strategy 3: Search JIRA by Freshservice ticket ID
                    if (teamName == "Unknown" && jiraKey == null)
                    {
                        var searchResult = await LookupJiraIssue(httpClient, jiraBaseUrl, jiraAuth, $"text ~ \"{fsId}\" ORDER BY updated DESC");
                        if (searchResult.key != null && projectTeamMap.ContainsKey(searchResult.projectPrefix))
                        {
                            jiraKey = searchResult.key;
                            jiraStatus = searchResult.status;
                            jiraAssignee = searchResult.assignee;
            teamName = ResolveTeamFromJiraPrefix(searchResult.projectPrefix, projectTeamMap);
                        }
                    }
                }

                // Strategy 4: Match project names in title
                if (teamName == "Unknown" || teamName == "Enterprise Solution" || teamName == "Developers")
                {
                    // Build a project-to-team map if not done for this sync
                    var projectToTeamList = await connection.QueryAsync<(string name, string team)>("SELECT p.name, t.name as team FROM projects p JOIN teams t ON p.team_id = t.id");
                    foreach (var pMatch in projectToTeamList)
                    {
                        if (subject.Contains(pMatch.name, StringComparison.OrdinalIgnoreCase))
                        {
                            teamName = pMatch.team;
                            break;
                        }
                    }
                }


                // Clean description
                var cleanDesc = description.Length > 2000 ? description.Substring(0, 1997) + "..." : description;
                cleanDesc = cleanDesc.Replace("\0", "");
                var cleanTitle = subject.Replace("\0", "");

                // Upsert into DB (preserve team if manually set and we still say "Unknown")
                await connection.ExecuteAsync(@"
                    INSERT INTO development_incidents 
                        (freshservice_id, jira_key, title, description, freshservice_status, 
                         jira_status, priority, team, assigned_to, source, created_at, updated_at)
                    VALUES 
                        (@FsId, @JiraKey, @Title, @Desc, @FsStatus, 
                         @JiraStatus, @Priority, @Team, @Assignee, 'Freshservice', @CreatedAt, @UpdatedAt)
                    ON CONFLICT (freshservice_id) DO UPDATE SET
                        jira_key       = EXCLUDED.jira_key,
                        title          = EXCLUDED.title,
                        description    = EXCLUDED.description,
                        freshservice_status = EXCLUDED.freshservice_status,
                        jira_status    = EXCLUDED.jira_status,
                        priority       = EXCLUDED.priority,
                        team           = CASE WHEN development_incidents.team != 'Unknown' AND EXCLUDED.team = 'Unknown'
                                            THEN development_incidents.team   -- Preserve manual team assignment
                                            ELSE EXCLUDED.team END,
                        assigned_to    = EXCLUDED.assigned_to,
                        updated_at     = EXCLUDED.updated_at",
                    new {
                        FsId = fsId,
                        JiraKey = jiraKey,
                        Title = cleanTitle,
                        Desc = cleanDesc,
                        FsStatus = MapStatusToLabel(ticket.Status),
                        JiraStatus = jiraStatus,
                        Priority = priorityText,
                        Team = teamName.Trim(),
                        Assignee = jiraAssignee,
                        CreatedAt = createdAt,
                        UpdatedAt = updatedAt
                    });

                synced++;
                _logger.LogInformation("L4 FS#{FsId} → JIRA:{JiraKey} Team:{Team} Status:{JiraStatus}", 
                    fsId, jiraKey ?? "none", teamName, jiraStatus);
            }

            _logger.LogInformation("L4 Sync complete. {Count} tickets processed.", synced);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in SyncDevelopmentIncidentsAsync");
            return false;
        }
    }

    private static string ResolveTeamFromJiraPrefix(string projectPrefix, Dictionary<string, string> projectTeamMap)
    {
        if (string.IsNullOrEmpty(projectPrefix)) return "Unknown";
        return projectTeamMap.TryGetValue(projectPrefix.ToUpperInvariant(), out var team) ? team : "Unknown";
    }

    private async Task<(string? key, string status, string assignee, string projectPrefix)> LookupJiraIssue(
        System.Net.Http.HttpClient httpClient, string jiraBaseUrl, string jiraAuth, string jql)
    {
        try
        {
            var body = System.Text.Json.JsonSerializer.Serialize(new
            {
                jql,
                maxResults = 1,
                fields = new[] { "status", "assignee", "project", "summary" }
            });

            var req = new System.Net.Http.HttpRequestMessage(System.Net.Http.HttpMethod.Post, $"{jiraBaseUrl}/search/jql");
            req.Headers.Add("Authorization", $"Basic {jiraAuth}");
            req.Headers.Add("Accept", "application/json");
            req.Content = new System.Net.Http.StringContent(body, System.Text.Encoding.UTF8, "application/json");

            var resp = await httpClient.SendAsync(req);
            if (!resp.IsSuccessStatusCode) return (null, "Awaiting Link", "Unassigned", "");

            var content = await resp.Content.ReadAsStringAsync();
            var doc = System.Text.Json.JsonDocument.Parse(content);

            if (!doc.RootElement.TryGetProperty("issues", out var issues)) return (null, "Awaiting Link", "Unassigned", "");
            var issueArr = issues.EnumerateArray().ToList();
            if (issueArr.Count == 0) return (null, "Awaiting Link", "Unassigned", "");

            var issue = issueArr[0];
            var key = issue.TryGetProperty("key", out var k) ? k.GetString() ?? "" : "";
            var projectPrefix = key.Contains('-') ? key.Split('-')[0] : "";

            var fields = issue.TryGetProperty("fields", out var f) ? f : default;
            var status = fields.ValueKind != System.Text.Json.JsonValueKind.Undefined && fields.TryGetProperty("status", out var s) && s.TryGetProperty("name", out var sn) ? sn.GetString() ?? "Unknown" : "Unknown";
            var assignee = fields.ValueKind != System.Text.Json.JsonValueKind.Undefined && fields.TryGetProperty("assignee", out var a) && a.ValueKind != System.Text.Json.JsonValueKind.Null && a.TryGetProperty("displayName", out var dn) ? dn.GetString() ?? "Unassigned" : "Unassigned";

            return (key, status, assignee, projectPrefix);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "JIRA lookup failed for JQL: {Jql}", jql);
            return (null, "Awaiting Link", "Unassigned", "");
        }
    }


    public async Task<List<DevelopmentIncident>> GetDevelopmentIncidentsAsync(DateTime? startDate = null, DateTime? endDate = null)
    {
        try 
        {
            using var connection = await GetConnectionAsync();
            var conditions = new List<string>();
            var p = new DynamicParameters();
            
            conditions.Add("freshservice_status NOT IN ('Resolved/Closed', 'Resolved', 'Closed', 'Declined', 'Rejected')");
            conditions.Add("(reassigned_from_l4 IS NULL OR reassigned_from_l4 = false)");

            if (startDate.HasValue)
            {
                conditions.Add("created_at >= @StartDate");
                p.Add("StartDate", startDate.Value);
            }
            if (endDate.HasValue)
            {
                conditions.Add("created_at < @EndDateLimit");
                p.Add("EndDateLimit", endDate.Value.AddDays(1));
            }

            var whereClause = "WHERE " + string.Join(" AND ", conditions);

            var sql = $@"
                SELECT 
                    id AS Id, 
                    freshservice_id AS FreshdeskId, 
                    jira_key AS JiraKey, 
                    title AS Title, 
                    description AS Description,
                    freshservice_status AS FreshserviceStatus, 
                    jira_status AS JiraStatus, 
                    priority AS Priority, 
                    team AS Team, 
                    assigned_to AS AssignedTo,
                    source AS Source,
                    created_at AS CreatedAt, 
                    updated_at AS UpdatedAt, 
                    resolved_at AS ResolvedAt, 
                    sla_breach AS SlaBreach, 
                    delivery_points AS DeliveryPoints,
                    reassigned_from_l4 AS ReassignedFromL4,
                    reassigned_to_level AS ReassignedToLevel,
                    reassigned_at AS ReassignedAt
                FROM development_incidents 
                {whereClause}
                ORDER BY created_at DESC";
            
            var incidents = await connection.QueryAsync<DevelopmentIncident>(sql, p);
            return incidents.ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving development incidents from development_incidents table");
            return new List<DevelopmentIncident>();
        }
    }

    public async Task<bool> UpdateDevelopmentIncidentTeamAsync(int id, string team)
    {
        try
        {
            // Normalize team name to match canonical names for dev teams
            string normalizedTeam = team?.Trim() switch
            {
                var s when string.Equals(s, "Data & Identity", StringComparison.OrdinalIgnoreCase) || 
                           string.Equals(s, "Data and Identity", StringComparison.OrdinalIgnoreCase) ||
                           string.Equals(s, "Identity", StringComparison.OrdinalIgnoreCase) => "Data & Identity",
                
                var s when string.Equals(s, "Collections", StringComparison.OrdinalIgnoreCase) => "Collections",
                
                var s when string.Equals(s, "Core Switching", StringComparison.OrdinalIgnoreCase) || 
                           string.Equals(s, "Core", StringComparison.OrdinalIgnoreCase) || 
                           string.Equals(s, "Switching", StringComparison.OrdinalIgnoreCase) => "Core Switching",
                
                var s when string.Equals(s, "Enterprise Solutions", StringComparison.OrdinalIgnoreCase) || 
                           string.Equals(s, "Enterprise", StringComparison.OrdinalIgnoreCase) => "Enterprise Solutions",
                
                _ => team?.Trim() ?? "Unknown"
            };

            using var connection = await GetConnectionAsync();
            var sql = "UPDATE development_incidents SET team = @Team, updated_at = @UpdatedAt WHERE id = @Id";
            var rows = await connection.ExecuteAsync(sql, new { Team = normalizedTeam, UpdatedAt = DateTime.UtcNow, Id = id });
            return rows > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating team for development incident {IncidentId}", id);
            return false;
        }
    }

    public async Task<bool> ReassignDevelopmentIncidentLevelAsync(int id, string level)
    {
        try
        {
            // Validate the level is L1, L2, or L3
            var validLevels = new[] { "L1", "L2", "L3" };
            if (!validLevels.Contains(level, StringComparer.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Invalid level '{Level}' provided for reassignment of incident {IncidentId}", level, id);
                return false;
            }

            using var connection = await GetConnectionAsync();
            var sql = @"
                UPDATE development_incidents 
                SET 
                    reassigned_from_l4 = true,
                    reassigned_to_level = @Level,
                    reassigned_at = @ReassignedAt,
                    updated_at = @UpdatedAt
                WHERE id = @Id";
            
            var rows = await connection.ExecuteAsync(sql, new 
            { 
                Level = level.ToUpper(), 
                ReassignedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                Id = id 
            });
            
            return rows > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reassigning development incident {IncidentId} to level {Level}", id, level);
            return false;
        }
    }

    public async Task<ServiceRequest?> GetServiceRequestByExternalIdAsync(string externalId)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = @"
                SELECT 
                    id AS Id, 
                    title AS Title, 
                    description AS Description, 
                    freshdesk_id AS FreshdeskId, 
                    status AS Status, 
                    priority AS Priority, 
                    category AS Category,
                    requester AS Requester, 
                    requester_email AS RequesterEmail, 
                    assigned_to AS AssignedTo, 
                    channel AS Channel, 
                    complexity AS Complexity, 
                    risk AS Risk,
                    delivery_points AS DeliveryPoints, 
                    sla_due_date AS SlaDueDate, 
                    native_sla_due_date AS NativeSlaDueDate, 
                    sla_breach AS SlaBreach,
                    ticket_type AS TicketType, 
                    support_level AS SupportLevel, 
                    source AS Source, 
                    team AS Team, 
                    linked_ticket_id AS LinkedTicketId,
                    linked_ticket_source AS LinkedTicketSource, 
                    escalation_status AS EscalationStatus, 
                    created_at AS CreatedAt, 
                    updated_at AS UpdatedAt,
                    resolved_at AS ResolvedAt, 
                    freshdesk_updated_at AS FreshdeskUpdatedAt
                FROM incidentsandservice 
                WHERE freshdesk_id = @ExternalId";
            
            return await connection.QueryFirstOrDefaultAsync<ServiceRequest>(sql, new { ExternalId = externalId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving service request by external ID {ExternalId}", externalId);
            return null;
        }
    }

    public async Task<int> UpsertServiceRequestAsync(ServiceRequest request)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = @"
                INSERT INTO incidentsandservice (
                    title, description, freshdesk_id, status, priority, category,
                    requester, requester_email, institution, assigned_to, channel, complexity, risk,
                    delivery_points, sla_due_date, native_sla_due_date, sla_breach,
                    ticket_type, support_level, source, team, linked_ticket_id,
                    linked_ticket_source, escalation_status, created_at, updated_at,
                    resolved_at, freshdesk_updated_at
                ) VALUES (
                    @Title, @Description, @FreshdeskId, @Status, @Priority, @Category,
                    @Requester, @RequesterEmail, @Institution, @AssignedTo, @Channel, @Complexity, @Risk,
                    @DeliveryPoints, @SlaDueDate, @NativeSlaDueDate, @SlaBreach,
                    @TicketType, @SupportLevel, @Source, @Team, @LinkedTicketId,
                    @LinkedTicketSource, @EscalationStatus, @CreatedAt, @UpdatedAt,
                    @ResolvedAt, @FreshdeskUpdatedAt
                )
                ON CONFLICT (freshdesk_id) DO UPDATE SET
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    status = EXCLUDED.status,
                    priority = EXCLUDED.priority,
                    category = EXCLUDED.category,
                    institution = EXCLUDED.institution,
                    assigned_to = EXCLUDED.assigned_to,
                    support_level = CASE 
                        WHEN (CASE EXCLUDED.support_level WHEN 'L4' THEN 4 WHEN 'L3' THEN 3 WHEN 'L2' THEN 2 WHEN 'L1' THEN 1 ELSE 0 END) > 
                             (CASE incidentsandservice.support_level WHEN 'L4' THEN 4 WHEN 'L3' THEN 3 WHEN 'L2' THEN 2 WHEN 'L1' THEN 1 ELSE 0 END) 
                        THEN EXCLUDED.support_level 
                        ELSE incidentsandservice.support_level 
                    END,
                    team = EXCLUDED.team,
                    linked_ticket_id = EXCLUDED.linked_ticket_id,
                    linked_ticket_source = EXCLUDED.linked_ticket_source,
                    escalation_status = EXCLUDED.escalation_status,
                    updated_at = EXCLUDED.updated_at,
                    freshdesk_updated_at = EXCLUDED.freshdesk_updated_at
                RETURNING id";
            
            // Auto-populate institution if missing
            if (string.IsNullOrEmpty(request.Institution)) {
                request.Institution = GetInstitutionFromEmail(request.RequesterEmail);
            }
            
            var id = await connection.QuerySingleAsync<int>(sql, request);
            return id;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error upserting service request {FreshdeskId}", request.FreshdeskId);
            return 0;
        }
    }

    public async Task<bool> CloseLinkedFreshserviceTicketsAsync(string jiraTicketId)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = @"
                UPDATE incidentsandservice
                SET status = 4, resolved_at = @ResolvedAt, updated_at = @UpdatedAt
                WHERE linked_ticket_id = @JiraTicketId AND status != 4";
            
            var rowsAffected = await connection.ExecuteAsync(sql, new 
            { 
                JiraTicketId = jiraTicketId, 
                ResolvedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            
            if (rowsAffected > 0)
            {
                _logger.LogInformation("Closed {Count} Freshservice tickets linked to JIRA {JiraKey}", rowsAffected, jiraTicketId);
            }
            
            return rowsAffected > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error closing linked Freshservice tickets for JIRA {JiraKey}", jiraTicketId);
            return false;
        }
    }

    public async Task<int> CreateServiceRequestMovementAsync(ServiceRequestMovement movement)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = @"
                INSERT INTO service_request_movements (service_request_id, external_id, source, from_level, to_level, from_status, to_status, changed_by, created_at)
                VALUES (@ServiceRequestId, @ExternalId, @Source, @FromLevel, @ToLevel, @FromStatus, @ToStatus, @ChangedBy, @CreatedAt)
                RETURNING id";
            
            if (movement.CreatedAt == default)
                movement.CreatedAt = DateTime.UtcNow;

            return await connection.ExecuteScalarAsync<int>(sql, movement);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating service request movement for {ExternalId}", movement.ExternalId);
            return 0;
        }
    }

    public async Task<List<ServiceRequestMovement>> GetServiceRequestMovementsAsync(string? externalId = null)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = @"
                SELECT 
                    id AS Id, 
                    service_request_id AS ServiceRequestId, 
                    external_id AS ExternalId, 
                    source AS Source, 
                    from_level AS FromLevel, 
                    to_level AS ToLevel, 
                    from_status AS FromStatus, 
                    to_status AS ToStatus, 
                    changed_by AS ChangedBy, 
                    created_at AS CreatedAt
                FROM service_request_movements";
            
            var parameters = new DynamicParameters();

            if (!string.IsNullOrEmpty(externalId))
            {
                sql += " WHERE external_id = @ExternalId";
                parameters.Add("ExternalId", externalId);
            }

            sql += " ORDER BY created_at ASC";
            var movements = await connection.QueryAsync<ServiceRequestMovement>(sql, parameters);
            return movements.ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving service request movements");
            return new List<ServiceRequestMovement>();
        }
    }

    public async Task<int> CreateEscalationAsync(Escalation escalation)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = @"
                INSERT INTO escalations (service_request_id, freshdesk_id, from_level, to_level, escalated_at, escalated_by, assigned_team, title, status)
                VALUES (@ServiceRequestId, @FreshdeskId, @FromLevel, @ToLevel, @EscalatedAt, @EscalatedBy, @AssignedTeam, @Title, @Status)
                ON CONFLICT (service_request_id, from_level, to_level, escalated_at) DO NOTHING
                RETURNING id";
            
            if (escalation.EscalatedAt == default)
                escalation.EscalatedAt = DateTime.UtcNow;

            return await connection.ExecuteScalarAsync<int>(sql, escalation);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating escalation record for {FreshdeskId}", escalation.FreshdeskId);
            return 0;
        }
    }

    public async Task<List<Escalation>> GetEscalationRecordsAsync(string? fromLevel = null, string? toLevel = null, DateTime? startDate = null, DateTime? endDate = null)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = @"
                SELECT 
                    e.id AS Id, 
                    e.service_request_id AS ServiceRequestId, 
                    e.freshdesk_id AS FreshdeskId, 
                    e.from_level AS FromLevel, 
                    e.to_level AS ToLevel, 
                    e.escalated_at AS EscalatedAt, 
                    e.escalated_by AS EscalatedBy, 
                    e.assigned_team AS AssignedTeam, 
                    e.title AS Title, 
                    e.status AS Status,
                    t.sla_breach AS SlaBreach,
                    t.support_level AS SupportLevel,
                    t.description AS Description
                FROM escalations e
                JOIN incidentsandservice t ON e.service_request_id = t.id
                WHERE 1=1";
            
            var parameters = new DynamicParameters();

            if (startDate.HasValue)
            {
                // Ensure we get everything from the start of the selected day
                var start = DateTime.SpecifyKind(startDate.Value.Date, DateTimeKind.Utc);
                sql += " AND e.escalated_at >= @StartDate";
                parameters.Add("StartDate", start);
            }

            if (endDate.HasValue)
            {
                // Ensure we get everything up to the very end of the selected day
                var end = DateTime.SpecifyKind(endDate.Value.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);
                sql += " AND e.escalated_at <= @EndDate";
                parameters.Add("EndDate", end);
            }

            if (!string.IsNullOrEmpty(fromLevel) && fromLevel != "All Levels")
            {
                sql += " AND e.from_level = @FromLevel";
                parameters.Add("FromLevel", fromLevel);
            }

            if (!string.IsNullOrEmpty(toLevel) && toLevel != "All Levels")
            {
                sql += " AND e.to_level = @ToLevel";
                parameters.Add("ToLevel", toLevel);
            }

            sql += " ORDER BY e.escalated_at DESC";
            var records = await connection.QueryAsync<Escalation>(sql, parameters);
            return records.ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving escalation records");
            return new List<Escalation>();
        }
    }

    public async Task<int> SyncEscalationsFromMovementsAsync()
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = @"
                INSERT INTO escalations (service_request_id, freshdesk_id, from_level, to_level, escalated_at, escalated_by, assigned_team, title, status)
                SELECT 
                    sub.service_request_id, 
                    sub.external_id, 
                    sub.from_level, 
                    sub.validated_to_level,
                    sub.created_at, 
                    sub.changed_by, 
                    sub.team, 
                    sub.title, 
                    sub.status
                FROM (
                    SELECT 
                        m.service_request_id, 
                        m.external_id, 
                        m.from_level, 
                        CASE 
                            WHEN m.to_level = 'L4' AND NOT (m.to_status ~* '18|L4|Awaiting L4') THEN 'L2'
                            ELSE m.to_level 
                        END as validated_to_level,
                        m.created_at, 
                        m.changed_by, 
                        t.team, 
                        t.title, 
                        t.status
                    FROM service_request_movements m
                    JOIN incidentsandservice t ON m.service_request_id = t.id
                    WHERE m.from_level != m.to_level
                ) sub
                WHERE sub.from_level != sub.validated_to_level
                AND (
                    (sub.from_level = 'L1' AND sub.validated_to_level IN ('L2', 'L3', 'L4')) OR
                    (sub.from_level = 'L2' AND sub.validated_to_level IN ('L3', 'L4')) OR
                    (sub.from_level = 'L3' AND sub.validated_to_level = 'L4')
                )
                ON CONFLICT (service_request_id, from_level, to_level, escalated_at) DO NOTHING";

            
            return await connection.ExecuteAsync(sql);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing escalations from movements");
            return 0;
        }
    }

    public async Task InitializeServiceRequestSchemaAsync()
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = @"
                CREATE TABLE IF NOT EXISTS incidentsandservice (
                    id SERIAL PRIMARY KEY,
                    title TEXT,
                    description TEXT,
                    freshdesk_id TEXT UNIQUE,
                    status INTEGER,
                    priority TEXT,
                    category TEXT,
                    requester TEXT,
                    requester_email TEXT,
                    assigned_to TEXT,
                    channel TEXT,
                    complexity INTEGER,
                    risk INTEGER,
                    delivery_points INTEGER,
                    sla_due_date TIMESTAMP,
                    native_sla_due_date TIMESTAMP,
                    sla_breach BOOLEAN,
                    ticket_type TEXT,
                    support_level TEXT,
                    source TEXT,
                    team TEXT,
                    linked_ticket_id TEXT,
                    linked_ticket_source TEXT,
                    escalation_status TEXT,
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP,
                    resolved_at TIMESTAMP,
                    freshdesk_updated_at TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS service_request_movements (
                    id SERIAL PRIMARY KEY,
                    service_request_id INTEGER REFERENCES incidentsandservice(id) ON DELETE SET NULL,
                    external_id TEXT NOT NULL,
                    source TEXT NOT NULL,
                    from_level TEXT,
                    to_level TEXT,
                    from_status TEXT,
                    to_status TEXT,
                    changed_by TEXT,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS escalations (
                    id SERIAL PRIMARY KEY,
                    service_request_id INTEGER REFERENCES incidentsandservice(id) ON DELETE CASCADE,
                    freshdesk_id TEXT NOT NULL,
                    from_level TEXT NOT NULL,
                    to_level TEXT NOT NULL,
                    escalated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    escalated_by TEXT,
                    assigned_team TEXT,
                    title TEXT,
                    status INTEGER,
                    UNIQUE(service_request_id, from_level, to_level, escalated_at)
                );
            ";
            await connection.ExecuteAsync(sql);
            _logger.LogInformation("Service request schema initialized");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initializing service request schema");
        }
    }

    public async Task<List<string>> GetAllColumnsAsync(string tableName)
    {
        using var connection = await GetConnectionAsync();
        var sql = "SELECT column_name FROM information_schema.columns WHERE table_name = @TableName";
        var columns = await connection.QueryAsync<string>(sql, new { TableName = tableName });
        return columns.ToList();
    }

    public async Task<List<string>> GetAllTablesAsync()
    {
        using var connection = await GetConnectionAsync();
        var sql = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'";
        var tables = await connection.QueryAsync<string>(sql);
        return tables.ToList();
    }

    public async Task<int> ExecuteRawSqlAsync(string sql)
    {
        using var connection = await GetConnectionAsync();
        return await connection.ExecuteAsync(sql);
    }

    public async Task<List<dynamic>> QueryRawSqlAsync(string sql, object? parameters = null)
    {
        using var connection = await GetConnectionAsync();
        var result = await connection.QueryAsync(sql, parameters);
        return result.ToList();
    }
    public async Task PurgeOldDataAsync()
    {
        try
        {
            // DISABLED PURGE: User requires full historical accuracy and no data removal.
            _logger.LogInformation("Purge skipped: Retention policy set to infinite per user request.");
            
            /*
            using var connection = await GetConnectionAsync();
            var cutoff = DateTime.UtcNow.AddYears(-1);
            _logger.LogInformation("Purging data older than {Cutoff}", cutoff);
            
            var parameters = new DynamicParameters();
            parameters.Add("Cutoff", cutoff, System.Data.DbType.DateTime);

            // Delete movements first
            var movementsDeleted = await connection.ExecuteAsync("DELETE FROM ticket_movements WHERE created_at < @Cutoff", parameters);
            _logger.LogInformation("Deleted {Count} old ticket movements", movementsDeleted);

            // Delete old tickets next
            var ticketsDeleted = await connection.ExecuteAsync("DELETE FROM tickets WHERE created_at < @Cutoff", parameters);
            _logger.LogInformation("Deleted {Count} old tickets", ticketsDeleted);
            
            // Delete old projects (Epics)
            var projectsDeleted = await connection.ExecuteAsync("DELETE FROM projects WHERE start_date < @Cutoff OR start_date IS NULL", parameters);
            _logger.LogInformation("Deleted {Count} old projects", projectsDeleted);
            
            // Delete old incidents
            // incidents table deleted per user request
            // var incidentsDeleted = await connection.ExecuteAsync("DELETE FROM incidents WHERE created_at < @Cutoff", parameters);

            _logger.LogInformation("Purge complete: {T} tickets, {P} projects removed", ticketsDeleted, projectsDeleted);
            */
            
            await Task.CompletedTask;
        }

        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during skipped purge session");
        }
    }


    // Authentication Implementations
    public async Task InitializeAuthSchemaAsync()
    {
        try 
        {
            using var connection = await GetConnectionAsync();
            var sql = @"
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    email TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    first_name TEXT,
                    last_name TEXT,
                    role TEXT NOT NULL DEFAULT 'User',
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
                    created_at TIMESTAMP DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS invitations (
                    id SERIAL PRIMARY KEY,
                    email TEXT NOT NULL,
                    token TEXT NOT NULL UNIQUE,
                    role TEXT NOT NULL DEFAULT 'User',
                    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
                    created_at TIMESTAMP DEFAULT NOW(),
                    expires_at TIMESTAMP NOT NULL,
                    is_used BOOLEAN DEFAULT FALSE
                );
            ";
            await connection.ExecuteAsync(sql);
            _logger.LogInformation("Auth schema initialized");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initializing auth schema");
        }
    }

    public async Task<int> CreateUserAsync(Auth.User user)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = @"
                INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, permissions, created_at)
                VALUES (@Email, @PasswordHash, @FirstName, @LastName, @Role, @IsActive, @Permissions::jsonb, @CreatedAt)
                RETURNING id;
            ";
            return await connection.ExecuteScalarAsync<int>(sql, user);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating user {Email}", user.Email);
            return 0;
        }
    }

    public async Task<Auth.User?> GetUserByEmailAsync(string email)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            return await connection.QueryFirstOrDefaultAsync<Auth.User>(
                "SELECT id, email, password_hash as PasswordHash, first_name as FirstName, last_name as LastName, role, theme as Theme, is_active as IsActive, permissions, created_at as CreatedAt FROM users WHERE LOWER(email) = LOWER(@Email)", 
                new { Email = email });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching user {Email}", email);
            return null;
        }
    }

    public async Task<List<Auth.User>> GetAllUsersAsync()
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = "SELECT id, email, password_hash as PasswordHash, first_name as FirstName, last_name as LastName, role, theme as Theme, is_active as IsActive, permissions, created_at as CreatedAt FROM users ORDER BY created_at DESC";
            var users = await connection.QueryAsync<Auth.User>(sql);
            return users.ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching all users");
            return new List<Auth.User>();
        }
    }

    public async Task<bool> UpdateUserAsync(int userId, string role, string permissionsJson)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = "UPDATE users SET role = @Role, permissions = @Permissions::jsonb WHERE id = @Id";
            var rowsAffected = await connection.ExecuteAsync(sql, new { Role = role, Permissions = permissionsJson, Id = userId });
            _logger.LogInformation("UpdateUserAsync: UserId={UserId}, Role={Role}, RowsAffected={Rows}, Permissions={Permissions}", userId, role, rowsAffected, permissionsJson);
            return rowsAffected > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating user {UserId}", userId);
            return false;
        }
    }

    public async Task<bool> UpdateUserStatusAsync(int userId, bool isActive)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = "UPDATE users SET is_active = @IsActive WHERE id = @Id";
            var rowsAffected = await connection.ExecuteAsync(sql, new { IsActive = isActive, Id = userId });
            _logger.LogInformation("UpdateUserStatusAsync: UserId={UserId}, IsActive={IsActive}, RowsAffected={Rows}", userId, isActive, rowsAffected);
            return rowsAffected > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating status for user {UserId}", userId);
            return false;
        }
    }

    public async Task<bool> UpdateUserThemeAsync(string email, string theme)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = "UPDATE users SET theme = @Theme WHERE LOWER(email) = LOWER(@Email)";
            var rowsAffected = await connection.ExecuteAsync(sql, new { Theme = theme, Email = email });
            _logger.LogInformation("UpdateUserThemeAsync: Email={Email}, Theme={Theme}, RowsAffected={Rows}", email, theme, rowsAffected);
            return rowsAffected > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating theme for user {Email}", email);
            return false;
        }
    }

    public async Task<bool> UpdateUserPasswordAsync(string email, string passwordHash)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = "UPDATE users SET password_hash = @PasswordHash, updated_at = NOW() WHERE LOWER(email) = LOWER(@Email)";
            var rowsAffected = await connection.ExecuteAsync(sql, new { PasswordHash = passwordHash, Email = email });
            return rowsAffected > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating password for user {Email}", email);
            return false;
        }
    }

    public async Task<string> CreateInvitationAsync(Auth.Invitation invitation)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            invitation.Token = Guid.NewGuid().ToString("N"); // Generate secure token
            var sql = @"
                INSERT INTO invitations (email, token, role, permissions, created_at, expires_at, is_used)
                VALUES (@Email, @Token, @Role, @Permissions::jsonb, @CreatedAt, @ExpiresAt, @IsUsed)
                RETURNING token;
            ";
            return await connection.ExecuteScalarAsync<string>(sql, invitation);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating invitation for {Email}", invitation.Email);
            return string.Empty;
        }
    }

    public async Task<Auth.Invitation?> GetInvitationByTokenAsync(string token)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            return await connection.QueryFirstOrDefaultAsync<Auth.Invitation>(
                "SELECT id, email, token, role, permissions, created_at as CreatedAt, expires_at as ExpiresAt, is_used as IsUsed FROM invitations WHERE token = @Token AND is_used = FALSE AND expires_at > NOW()", 
                new { Token = token });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching invitation {Token}", token);
            return null;
        }
    }

    public async Task<bool> MarkInvitationAsUsedAsync(int invitationId)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var affected = await connection.ExecuteAsync("UPDATE invitations SET is_used = TRUE WHERE id = @Id", new { Id = invitationId });
            return affected > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error marking invitation {Id} as used", invitationId);
            return false;
        }
    }

    public async Task<List<TicketMovement>> GetTicketMovementsAsync(string? jiraKey = null, DateTime? startDate = null, DateTime? endDate = null)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var conditions = new List<string>();
            var p = new DynamicParameters();

            if (!string.IsNullOrEmpty(jiraKey))
            {
                conditions.Add("LOWER(jira_key) = LOWER(@JiraKey)");
                p.Add("JiraKey", jiraKey);
            }

            if (startDate.HasValue)
            {
                conditions.Add("created_at >= @StartDate");
                p.Add("StartDate", startDate.Value);
            }
            if (endDate.HasValue)
            {
                conditions.Add("created_at < @EndDateLimit");
                p.Add("EndDateLimit", endDate.Value.AddDays(1));
            }
            
            if (!startDate.HasValue && !endDate.HasValue)
            {
                conditions.Add("created_at >= DATE_TRUNC('day', NOW() - INTERVAL '1 year')");
            }

            var whereClause = conditions.Count > 0 ? "WHERE " + string.Join(" AND ", conditions) : "";

            var sql = $@"
                SELECT id as Id, ticket_id as TicketId, jira_key as JiraKey, from_status as FromStatus, 
                       to_status as ToStatus, changed_by as ChangedBy, reason as Reason, 
                       justification as Justification, justified_by as JustifiedBy, justified_at as JustifiedAt,
                       created_at as CreatedAt, is_rollback as IsRollback
                FROM ticket_movements 
                {whereClause}
                ORDER BY created_at DESC";
            
            var movements = await connection.QueryAsync<TicketMovement>(sql, p);
            return movements.ToList();

        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving ticket movements");
            return new List<TicketMovement>();
        }
    }

    public async Task<bool> UpdateMovementJustificationAsync(int movementId, string justification, string justifiedBy)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            
            // Fetch current state to check if we should append history
            var current = await connection.QueryFirstOrDefaultAsync<dynamic>(
                "SELECT justification, justified_by FROM ticket_movements WHERE id = @Id", 
                new { Id = movementId });

            string finalJustification = justification;
            string finalJustifiedBy = justifiedBy;

            if (current != null && !string.IsNullOrEmpty((string)current.justified_by))
            {
                string oldJustifiedBy = (string)current.justified_by;
                string oldJustification = (string)current.justification ?? "";

                if (!oldJustifiedBy.Equals(justifiedBy, StringComparison.OrdinalIgnoreCase))
                {
                    // Different user: Show previous justification, show change, and who made the change
                    finalJustification = $"[PREVIOUS BY {oldJustifiedBy}]: {oldJustification}\n[UPDATED BY {justifiedBy}]: {justification}";
                }
                else
                {
                    // Same user: Keep their email, just update text and timestamp
                    finalJustifiedBy = oldJustifiedBy;
                }
            }

            var sql = "UPDATE ticket_movements SET justification = @Justification, justified_by = @JustifiedBy, justified_at = @JustifiedAt WHERE id = @Id";
            var rows = await connection.ExecuteAsync(sql, new 
            { 
                Id = movementId, 
                Justification = finalJustification, 
                JustifiedBy = finalJustifiedBy,
                JustifiedAt = DateTime.UtcNow
            });
            return rows > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating justification for movement {Id}", movementId);
            return false;
        }
    }


    // Jira Project Source Operations
    public async Task InitializeJiraSchemaAsync()
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = @"
                CREATE TABLE IF NOT EXISTS projects (
                    id SERIAL PRIMARY KEY,
                    jira_key TEXT UNIQUE,
                    name TEXT NOT NULL,
                    team_id INTEGER,
                    start_date TIMESTAMP,
                    target_date TIMESTAMP,
                    status TEXT,
                    description TEXT,
                    lead TEXT
                );

                CREATE TABLE IF NOT EXISTS tickets (
                    id SERIAL PRIMARY KEY,
                    jira_key TEXT NOT NULL UNIQUE,
                    epic_key TEXT,
                    title TEXT NOT NULL,
                    description TEXT,
                    status INTEGER NOT NULL,
                    complexity INTEGER DEFAULT 0,
                    risk INTEGER DEFAULT 0,
                    delivery_points INTEGER DEFAULT 0,
                    cab_approved BOOLEAN DEFAULT FALSE,
                    cab_rejection_reason TEXT,
                    points_locked BOOLEAN DEFAULT FALSE,
                    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
                    assigned_to TEXT,
                    jira_updated_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS teams (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    lead TEXT,
                    members INTEGER DEFAULT 0,
                    project_key TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS jira_project_sources (
                    jira_key TEXT PRIMARY KEY,
                    jira_name TEXT NOT NULL,
                    category TEXT,
                    team_id INT,
                    last_synced_at TIMESTAMP DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS ticket_movements (
                    id SERIAL PRIMARY KEY,
                    ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
                    jira_key TEXT NOT NULL,
                    from_status TEXT,
                    to_status TEXT NOT NULL,
                    changed_by TEXT,
                    reason TEXT,
                    justification TEXT,
                    justified_by TEXT,
                    justified_at TIMESTAMP,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    is_rollback BOOLEAN DEFAULT FALSE
                );

                ALTER TABLE ticket_movements ADD COLUMN IF NOT EXISTS justified_by TEXT;
                ALTER TABLE ticket_movements ADD COLUMN IF NOT EXISTS justified_at TIMESTAMP;
            ";

            await connection.ExecuteAsync(sql);
            _logger.LogInformation("Jira schema initialized - tables verified");

            // Seed teams if empty
            var teamCount = await connection.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM teams");
            if (teamCount == 0)
            {
                _logger.LogInformation("Seeding initial teams...");
                var seedSql = @"
                    INSERT INTO teams (name, lead, members, project_key)
                    VALUES 
                        ('Collections', 'Adebayo Oluwaseun', 12, 'SKP'),
                        ('Data & Identity', 'Ibrahim Mohammed', 10, 'IR'),
                        ('Core Switching', 'Chioma Nwosu', 15, 'CAS'),
                        ('Enterprise Solution', 'Fatima Abubakar', 13, 'BARP3');
                ";
                await connection.ExecuteAsync(seedSql);
            }

            // Update existing team records if they exist but have old names/keys
            await connection.ExecuteAsync("UPDATE teams SET name = 'Core Switching', project_key = 'CAS' WHERE project_key = 'CASP'");
            await connection.ExecuteAsync("UPDATE teams SET name = 'Enterprise Solution' WHERE name = 'Enterprise Solutions Team'");
            await connection.ExecuteAsync("UPDATE teams SET project_key = 'CAS' WHERE name = 'Core Switching' AND project_key = 'CASP'");

        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initializing Jira schema");
        }
    }

    public async Task UpsertJiraProjectSourceAsync(string key, string name, string category, int? teamId = null)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            
            // Only update team_id if explicitly provided (not null)
            // If teamId is null, we preserve existing value or default to NULL on insert
            var sql = @"
                INSERT INTO jira_project_sources (jira_key, jira_name, category, team_id, last_synced_at)
                VALUES (@Key, @Name, @Category, @TeamId, @LastSyncedAt)
                ON CONFLICT (jira_key) DO UPDATE SET
                    jira_name = EXCLUDED.jira_name,
                    category = EXCLUDED.category,
                    last_synced_at = EXCLUDED.last_synced_at
                    " + (teamId.HasValue ? ", team_id = EXCLUDED.team_id" : "") + @";
            ";
            
            await connection.ExecuteAsync(sql, new 
            { 
                Key = key, 
                Name = name, 
                Category = category, 
                TeamId = teamId,
                LastSyncedAt = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error upserting Jira Project Source {Key}", key);
        }
    }

    public async Task<List<dynamic>> GetAllJiraProjectSourcesAsync()
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = "SELECT * FROM jira_project_sources ORDER BY jira_name";
            var result = await connection.QueryAsync(sql);
            return result.ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all Jira Project Sources");
            return new List<dynamic>();
        }
    }
    public async Task<List<Team>> GetTeamsAsync()
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = "SELECT id, name, lead, members, project_key AS ProjectKey, created_at AS CreatedAt, updated_at AS UpdatedAt FROM teams ORDER BY id";
            var teams = await connection.QueryAsync<Team>(sql);
            return teams.ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving teams");
            return new List<Team>();
        }
    }

    public async Task<Team?> GetTeamByIdAsync(int id)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = "SELECT id, name, lead, members, project_key AS ProjectKey, created_at AS CreatedAt, updated_at AS UpdatedAt FROM teams WHERE id = @Id";
            return await connection.QueryFirstOrDefaultAsync<Team>(sql, new { Id = id });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving team {Id}", id);
            return null;
        }
    }

    public async Task<int> CreateTeamAsync(Team team)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = @"
                INSERT INTO teams (name, lead, members, project_key, created_at, updated_at)
                VALUES (@Name, @Lead, @Members, @ProjectKey, @CreatedAt, @UpdatedAt)
                RETURNING id";
            return await connection.ExecuteScalarAsync<int>(sql, team);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating team {Name}", team.Name);
            return 0;
        }
    }

    public async Task<bool> UpdateTeamAsync(Team team)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = @"
                UPDATE teams 
                SET name = @Name, lead = @Lead, members = @Members, 
                    project_key = @ProjectKey, updated_at = NOW()
                WHERE id = @Id";
            var affected = await connection.ExecuteAsync(sql, team);
            return affected > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating team {Id}", team.Id);
            return false;
        }
    }

    public async Task<bool> DeleteTeamAsync(int id)
    {
        try
        {
            using var connection = await GetConnectionAsync();
            var sql = "DELETE FROM teams WHERE id = @Id";
            var affected = await connection.ExecuteAsync(sql, new { Id = id });
            return affected > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting team {Id}", id);
            return false;
        }
    }
       
    public async Task<GovernanceAnalyticsResponse> GetGovernanceAnalyticsAsync(AnalyticsFilter? filter = null)
    {
        using var connection = await GetConnectionAsync();
        var response = new GovernanceAnalyticsResponse();

        // Build base filters
        var whereClause = new List<string> { "1=1" };
        var parameters = new DynamicParameters();

        if (filter != null)
        {
            var incidentHorizon = new DateTime(DateTime.UtcNow.Year, 1, 1);
            if (filter.StartDate.HasValue)
            {
                var effectiveStart = filter.StartDate.Value < incidentHorizon ? incidentHorizon : filter.StartDate.Value;
                whereClause.Add("created_at >= @StartDate");
                parameters.Add("StartDate", effectiveStart);
            }
            else
            {
                whereClause.Add("created_at >= @IncidentHorizon");
                parameters.Add("IncidentHorizon", incidentHorizon);
            }
            if (filter.EndDate.HasValue)
            {
                whereClause.Add("created_at <= @EndDate");
                parameters.Add("EndDate", filter.EndDate.Value);
            }
            if (!string.IsNullOrEmpty(filter.Team) && filter.Team != "All Teams")
            {
                whereClause.Add("team = @Team");
                parameters.Add("Team", filter.Team);
            }
            if (!string.IsNullOrEmpty(filter.Institution) && filter.Institution != "All Institutions")
            {
                whereClause.Add("institution = @Institution");
                parameters.Add("Institution", filter.Institution);
            }
            if (!string.IsNullOrEmpty(filter.Priority) && filter.Priority != "All Priorities")
            {
                whereClause.Add("priority = @Priority");
                parameters.Add("Priority", filter.Priority);
            }
        }

        var filterSql = string.Join(" AND ", whereClause);

        // 1. Institution Health
        var institutions = await connection.QueryAsync<InstitutionHealth>($@"
            SELECT 
                COALESCE(institution, 'Other') as Name, 
                COUNT(*) as Value,
                COUNT(CASE WHEN sla_breach = true THEN 1 END) as Breached
            FROM incidentsandservice
            WHERE {filterSql}
            GROUP BY institution
            ORDER BY Value DESC
            LIMIT 15", parameters);
        
        var institutionList = institutions.ToList();
        foreach(var inst in institutionList)
        {
            inst.ComplianceRate = inst.Value > 0 ? (1 - (double)inst.Breached / inst.Value) * 100 : 100;
        }
        response.InstitutionHealth = institutionList;

        // 2. Team Breach Matrix
        var matrix = await connection.QueryAsync<dynamic>($@"
            SELECT 
                COALESCE(team, 'Unknown') as Team,
                priority,
                COUNT(*) as Count
            FROM incidentsandservice
            WHERE sla_breach = true AND {filterSql}
            GROUP BY team, priority", parameters);

        var matrixList = matrix.ToList();
        var teamGroups = matrixList.GroupBy(m => (string)(m.Team ?? "Unknown"));
        foreach(var group in teamGroups)
        {
            response.TeamMatrix.Add(new TeamBreachMatrix {
                Team = group.Key,
                Critical = group.Where(m => (string)m.priority == "Critical" || (string)m.priority == "Urgent").Sum(m => (int)Convert.ToInt32(m.Count)),
                High = group.Where(m => (string)m.priority == "High").Sum(m => (int)Convert.ToInt32(m.Count)),
                Medium = group.Where(m => (string)m.priority == "Medium").Sum(m => (int)Convert.ToInt32(m.Count)),
                Low = group.Where(m => (string)m.priority == "Low").Sum(m => (int)Convert.ToInt32(m.Count))
            });
        }

        // 3. Breach Aging
        var aging = await connection.QueryAsync<BreachAgingTrend>($@"
            SELECT 
                CASE 
                    WHEN EXTRACT(EPOCH FROM (NOW() - sla_due_date)) / 3600 <= 4 THEN '0-4h'
                    WHEN EXTRACT(EPOCH FROM (NOW() - sla_due_date)) / 3600 <= 24 THEN '4-24h'
                    ELSE '24h+'
                END as Bucket,
                COUNT(*) as Count
            FROM incidentsandservice
            WHERE sla_breach = true AND sla_due_date IS NOT NULL AND {filterSql}
            GROUP BY Bucket", parameters);
        response.AgingTrends = aging.ToList();

        // 4. Historical Trends (Default to current year horizon)
        string trendFilter = filterSql;
        if (filter == null || !filter.StartDate.HasValue) {
            trendFilter += " AND created_at >= @TrendHorizon";
            parameters.Add("TrendHorizon", new DateTime(DateTime.UtcNow.Year, 1, 1));
        }

        var trends = await connection.QueryAsync<HistoricalComplianceTrend>($@"
            SELECT 
                TO_CHAR(created_at, 'YYYY-MM-DD') as Date,
                COUNT(*) as Volume,
                ROUND((1 - COUNT(CASE WHEN sla_breach = true THEN 1 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as Compliance
            FROM incidentsandservice
            WHERE {trendFilter}
            GROUP BY Date
            ORDER BY Date ASC", parameters);
        response.ComplianceTrends = trends.ToList();
        
        // Ensure parameters for stability query
        if (!parameters.ParameterNames.Contains("JiraHorizon")) {
            parameters.Add("JiraHorizon", new DateTime(DateTime.UtcNow.Year - 1, 1, 1));
        }

        // 5. Stability vs Velocity
        // Note: Stability uses both tickets and incidentsandservice. Filtering might be complex for both.
        // We'll apply the team/date filters to both if applicable.
        
        var stability = await connection.QueryAsync<DailyStabilityMetric>($@"
            SELECT 
                d_date as Date,
                SUM(points) as DeliveryPoints,
                SUM(incidents) as Incidents
            FROM (
                SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as d_date, SUM(delivery_points) as points, 0 as incidents
                FROM tickets 
                WHERE created_at >= @JiraHorizon
                GROUP BY d_date
                UNION ALL
                SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as d_date, 0 as points, COUNT(*) as incidents
                FROM incidentsandservice 
                WHERE ticket_type = 'Incident' AND {trendFilter}
                GROUP BY d_date
            ) combined
            GROUP BY Date
            ORDER BY Date ASC", parameters);
        response.OverallStability.History = stability.ToList();

        return response;
    }

    private string GetInstitutionFromEmail(string? email)
    {
        if (string.IsNullOrEmpty(email)) return "Other";
        
        var domain = email.Split('@').Last().ToLower();
        return domain switch
        {
            "accessbankplc.com" => "Access Bank",
            "accessbank.com" => "Access Bank",
            "zenithbank.com" => "Zenith Bank",
            "gtbank.com" => "GTBank",
            "gtco.co" => "GTBank",
            "firstbanknigeria.com" => "FirstBank",
            "ubagroup.com" => "UBA",
            "fcmb.com" => "FCMB",
            "unionbankng.com" => "Union Bank",
            "stanbicibtc.com" => "Stanbic IBTC",
            "sterling.ng" => "Sterling Bank",
            "fidelitybank.ng" => "Fidelity Bank",
            "wemaplc.com" => "Wema Bank",
            "polarisbanklimited.com" => "Polaris Bank",
            "unitybankng.com" => "Unity Bank",
            "nibss-plc.com.ng" => "NIBSS",
            _ => "Other"
        };
    }

    private string MapStatusToLabel(int status)
    {
        return status switch
        {
            2 => "Open",
            3 => "Pending",
            4 => "Resolved",
            5 => "Closed",
            6 => "Awaiting Customer",
            9 => "Awaiting Approval",
            10 => "Awaiting 3rd Party",
            18 => "Awaiting L4 Support",
            19 => "Change Freeze",
            _ => "Open"
        };
    }
}

public class L4TicketSource
{
    public string Id { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Description { get; set; } = "";
    public int Priority { get; set; }
    public int Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string Team { get; set; } = "Unknown";
    public string? JiraKey { get; set; }
    public Dictionary<string, object>? CustomFields { get; set; }
}
