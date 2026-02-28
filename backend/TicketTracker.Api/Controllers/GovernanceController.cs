using Microsoft.AspNetCore.Mvc;
using Dapper;
using Npgsql;
using TicketTracker.Api.Models.DTOs;
using TicketTracker.Api.Models.Entities;
using TicketTracker.Api.Services.Implementation;
using TicketTracker.Api.Services.Interfaces;

namespace TicketTracker.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class GovernanceController : ControllerBase
    {
        private readonly string _connectionString;
        private readonly FreshserviceService _freshserviceService;
        private readonly IConfiguration _configuration;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ISyncStatusService _statusService;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<GovernanceController> _logger;

        public GovernanceController(
            IConfiguration configuration,
            FreshserviceService freshserviceService,
            IHttpClientFactory httpClientFactory,
            ISyncStatusService statusService,
            IServiceScopeFactory scopeFactory,
            ILogger<GovernanceController> logger)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection") 
                ?? throw new InvalidOperationException("Connection string not found");
            _freshserviceService = freshserviceService;
            _configuration = configuration;
            _httpClientFactory = httpClientFactory;
            _statusService = statusService;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        [HttpGet("cockpit")]
        public async Task<ActionResult<GovernanceCockpitResponse>> GetGovernanceCockpit(
            [FromQuery] string? supportLevel = null,
            [FromQuery] string? team = null,
            [FromQuery] string? source = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? fromLevel = null,
            [FromQuery] string? toLevel = null)
        {
            using var connection = new NpgsqlConnection(_connectionString);

            // Build dynamic WHERE clause
            var whereConditions = new List<string>();
            var parameters = new DynamicParameters();
            
            if (startDate.HasValue)
            {
                whereConditions.Add("created_at >= @StartDate");
                parameters.Add("StartDate", startDate.Value);
            }

            if (endDate.HasValue)
            {
                whereConditions.Add("created_at < @EndDateLimit");
                parameters.Add("EndDateLimit", endDate.Value.AddDays(1));
            }

            if (!string.IsNullOrEmpty(fromLevel) && fromLevel != "All Levels")
            {
                whereConditions.Add("support_level >= @FromLevel");
                parameters.Add("FromLevel", fromLevel);
            }

            if (!string.IsNullOrEmpty(toLevel) && toLevel != "All Levels")
            {
                whereConditions.Add("support_level <= @ToLevel");
                parameters.Add("ToLevel", toLevel);
            }
            
            if (!string.IsNullOrEmpty(supportLevel) && supportLevel != "All Levels")
            {
                // When filtering for a specific tier (L1-L3), include L4 tickets 
                // but ONLY if they are assigned to someone who has tickets in that primary tier.
                // This ensures Damilola (L3 agent) gets his L4 tickets counted in L3 view, 
                // while an L1 agent's L4 tickets don't show up in L3.
                whereConditions.Add($@"(support_level = @SupportLevel OR 
                    (support_level = 'L4' AND assigned_to IN (SELECT DISTINCT assigned_to FROM incidentsandservice WHERE support_level = @SupportLevel)))");
                parameters.Add("SupportLevel", supportLevel);
            }
            
            if (!string.IsNullOrEmpty(team) && team != "All Teams")
            {
                whereConditions.Add("team = @Team");
                parameters.Add("Team", team);
            }
            
            if (!string.IsNullOrEmpty(source) && source != "All Sources" && !string.IsNullOrEmpty(source))
            {
                whereConditions.Add("source = @Source");
                parameters.Add("Source", source);
            }
            
            _logger.LogInformation("Fetch SLA Cockpit - Start: {Start}, End: {End}, Level: {Level}", 
                startDate, endDate, supportLevel);

            var whereClause = whereConditions.Count > 0 
                ? "WHERE " + string.Join(" AND ", whereConditions)
                : "";

            // Fetch all service requests from database with updated SLA status logic in query
            var query = $@"
                SELECT id, freshdesk_id, title, description, status, priority, category, 
                       complexity, risk, delivery_points, sla_due_date, 
                       CASE 
                           WHEN sla_due_date IS NOT NULL AND sla_due_date < @CurrentTime THEN true 
                           ELSE false 
                       END as sla_breach, 
                       ticket_type, support_level, source, team, linked_ticket_id, 
                       linked_ticket_source, escalation_status, requester, requester_email, 
                       assigned_to, channel, native_sla_due_date, created_at, updated_at
                FROM incidentsandservice 
                {whereClause}
                ORDER BY created_at DESC";

            parameters.Add("CurrentTime", DateTime.UtcNow);
            _logger.LogInformation("Executing query: {Query}, Params Count: {Count}", query, parameters.ParameterNames.Count());
            foreach (var name in parameters.ParameterNames)
            {
                _logger.LogInformation("Param {Name}: {Value}", name, parameters.Get<object>(name));
            }

            var serviceRequests = await connection.QueryAsync<dynamic>(query, parameters);

            var allItems = serviceRequests.ToList();

            // Calculate metrics based on the FILTERED items
            var metrics = new GovernanceMetrics
            {
                TotalItems = allItems.Count,
                OpenItems = allItems.Count(i => (i.status == 0 || i.status == 2) && i.ticket_type == "Service Request"),
                OpenIncidents = allItems.Count(i => (i.status == 0 || i.status == 2) && i.ticket_type == "Incident"),
                PendingItems = allItems.Count(i => new[] { 1, 3, 6, 9, 10, 18, 19 }.Contains((int)i.status)),
                ResolvedItems = allItems.Count(i => new[] { 4, 5, 7, 8 }.Contains((int)i.status)),
                CriticalItems = allItems.Count(i => i.priority == "Critical" || i.priority == "Urgent"),
                SlaBreaches = allItems.Count(i => i.sla_breach == true),
                AtRiskItems = allItems.Count(i => i.sla_due_date != null && 
                    DateTime.UtcNow.AddHours(1) >= i.sla_due_date && i.sla_breach == false),
                SlaComplianceRate = allItems.Count > 0 
                    ? (1 - (double)allItems.Count(i => i.sla_breach == true) / allItems.Count) * 100 
                    : 100
            };

            var slaAlerts = allItems
                .Where(i => (i.status == 0 || i.status == 1 || i.status == 2 || i.status == 3) && i.sla_due_date != null)
                .Select(i => new SlaAlert
                {
                    Id = i.id,
                    Type = i.type,
                    Title = i.title,
                    Priority = i.priority,
                    SlaDueDate = i.sla_due_date,
                    SlaBreach = i.sla_breach,
                    MinutesUntilBreach = i.sla_breach 
                        ? 0 
                        : (int)(((DateTime)i.sla_due_date - DateTime.Now).TotalMinutes)
                })
                .OrderBy(a => a.MinutesUntilBreach)
                .Take(10)
                .ToList();

            // Get oldest ticket date directly from database
            var oldestTicketDate = await connection.ExecuteScalarAsync<DateTime?>(
                "SELECT MIN(created_at) FROM incidentsandservice");

            _logger.LogInformation("Oldest ticket date: {Date}", oldestTicketDate);

            return Ok(new GovernanceCockpitResponse
            {
                Items = allItems,
                Metrics = metrics,
                SlaAlerts = slaAlerts,
                OldestTicketDate = oldestTicketDate,
                OldestIncidentDate = oldestTicketDate
            });
        }

        [HttpPost("sync")]
        public async Task<ActionResult> ManualSync()
        {
            var freshserviceEnabled = _configuration["FRESHSERVICE_ENABLED"] == "true";
            var freshdeskEnabled = _configuration["FRESHDESK_ENABLED"] == "true";
            
            if (!freshserviceEnabled && !freshdeskEnabled)
            {
                return BadRequest(new { message = "No integrations enabled" });
            }

            var jobId = _statusService.StartJob("Incidents & Requests");

            // Run in background
            _ = Task.Run(async () => {
                try 
                {
                    using var scope = _scopeFactory.CreateScope();
                    // We can't really use the controller methods directly safely because of 'this' context and DB connections
                    // but for a quick fix we'll replicate the core logic or call a service.
                    // Given the existing structure, I'll trigger the background sync logic essentially.
                    
                    _statusService.UpdateStatus(jobId, SyncStatus.Running, "Starting Freshdesk/Freshservice sync...", 10);
                    
                    using var connection = new NpgsqlConnection(_connectionString);
                    await connection.OpenAsync();

                    if (freshserviceEnabled)
                    {
                        _statusService.UpdateStatus(jobId, SyncStatus.Running, "Syncing Freshservice (L2)...", 30);
                        await SyncFreshserviceTickets(connection);
                    }
                    
                    if (freshdeskEnabled)
                    {
                        _statusService.UpdateStatus(jobId, SyncStatus.Running, "Syncing Freshdesk (L1)...", 60);
                        await SyncFreshdeskTickets(connection);
                    }
                    
                    _statusService.UpdateStatus(jobId, SyncStatus.Running, "Cleaning up and updating SLA status...", 90);
                    await CleanupOldTickets(connection);
                    await UpdateAllSlaBreachStatuses(connection);
                    
                    _statusService.UpdateStatus(jobId, SyncStatus.Completed, "Incidents and Service Requests sync completed.");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Background incident sync failed");
                    _statusService.UpdateStatus(jobId, SyncStatus.Failed, $"Sync failed: {ex.Message}");
                }
            });

            return Ok(new { message = "Sync started in background", jobId });
        }

        private async Task SyncFreshserviceTickets(NpgsqlConnection connection)
        {
            var freshTickets = await _freshserviceService.SyncCurrentYearAsync();
            
            foreach (var ticket in freshTickets)
            {
                // Clean null bytes from strings
                ticket.Title = ticket.Title?.Replace("\0", "") ?? "";
                ticket.Description = ticket.Description?.Replace("\0", "") ?? "";
                ticket.Category = ticket.Category?.Replace("\0", "") ?? "";
                ticket.Requester = ticket.Requester?.Replace("\0", "") ?? "";
                ticket.RequesterEmail = ticket.RequesterEmail?.Replace("\0", "") ?? "";
                ticket.AssignedTo = ticket.AssignedTo?.Replace("\0", "") ?? "";
                ticket.Channel = ticket.Channel?.Replace("\0", "") ?? "";
                
                // Check if ticket already exists (by freshdesk_id AND source)
                var exists = await connection.ExecuteScalarAsync<bool>(
                    "SELECT EXISTS(SELECT 1 FROM incidentsandservice WHERE freshdesk_id = @FreshdeskId AND source = @Source)",
                    new { ticket.FreshdeskId, ticket.Source });
                
                if (exists)
                {
                    // Update existing ticket
                    await connection.ExecuteAsync(@"
                        UPDATE incidentsandservice 
                        SET title = @Title, 
                            description = @Description, 
                            status = @Status, 
                            priority = @Priority, 
                            category = @Category,
                            ticket_type = @TicketType,
                            support_level = @SupportLevel,
                            team = @Team,
                            linked_ticket_id = @LinkedTicketId,
                            linked_ticket_source = @LinkedTicketSource,
                            escalation_status = @EscalationStatus,
                            source = @Source,
                            requester = @Requester,
                            requester_email = @RequesterEmail,
                            assigned_to = @AssignedTo,
                            channel = @Channel,
                            native_sla_due_date = @NativeSlaDueDate,
                            updated_at = @UpdatedAt
                        WHERE freshdesk_id = @FreshdeskId AND source = @Source",
                        ticket);
                }
                else
                {
                    // Insert new ticket
                    await connection.ExecuteAsync(@"
                        INSERT INTO incidentsandservice 
                        (freshdesk_id, title, description, status, priority, category, 
                         complexity, risk, delivery_points, sla_due_date, sla_breach, 
                         ticket_type, support_level, team, linked_ticket_id, linked_ticket_source, 
                         escalation_status, source, requester, requester_email, 
                         assigned_to, channel, native_sla_due_date, created_at, updated_at)
                        VALUES 
                        (@FreshdeskId, @Title, @Description, @Status, @Priority, @Category, 
                         @Complexity, @Risk, @DeliveryPoints, @SlaDueDate, @SlaBreach, 
                         @TicketType, @SupportLevel, @Team, @LinkedTicketId, @LinkedTicketSource, 
                         @EscalationStatus, @Source, @Requester, @RequesterEmail, 
                         @AssignedTo, @Channel, @NativeSlaDueDate, @CreatedAt, @UpdatedAt)",
                        ticket);
                }
            }
            
            _logger.LogInformation("Synced {Count} service requests (new + updated)", freshTickets.Count);
        }

        private async Task SyncFreshdeskTickets(NpgsqlConnection connection)
        {
            var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
            var freshdeskLogger = loggerFactory.CreateLogger<FreshdeskService>();
            var categorizationLogger = loggerFactory.CreateLogger<TicketCategorizationService>();
            var categorizationService = new TicketCategorizationService(_configuration, categorizationLogger);
            var freshdeskService = new FreshdeskService(_configuration, _httpClientFactory, freshdeskLogger, categorizationService);
            var freshTickets = await freshdeskService.SyncCurrentYearAsync();
            
            foreach (var ticket in freshTickets)
            {
                ticket.Title = ticket.Title?.Replace("\0", "") ?? "";
                ticket.Description = ticket.Description?.Replace("\0", "") ?? "";
                ticket.Category = ticket.Category?.Replace("\0", "") ?? "";
                ticket.Requester = ticket.Requester?.Replace("\0", "") ?? "";
                ticket.RequesterEmail = ticket.RequesterEmail?.Replace("\0", "") ?? "";
                ticket.AssignedTo = ticket.AssignedTo?.Replace("\0", "") ?? "";
                ticket.Channel = ticket.Channel?.Replace("\0", "") ?? "";
                
                var exists = await connection.ExecuteScalarAsync<bool>(
                    "SELECT EXISTS(SELECT 1 FROM incidentsandservice WHERE freshdesk_id = @FreshdeskId AND source = 'Freshdesk')",
                    new { ticket.FreshdeskId });
                
                if (exists)
                {
                    await connection.ExecuteAsync(@"
                        UPDATE incidentsandservice 
                        SET title = @Title, 
                            description = @Description, 
                            status = @Status, 
                            priority = @Priority, 
                            category = @Category,
                            ticket_type = @TicketType,
                            support_level = @SupportLevel,
                            team = @Team,
                            source = @Source,
                            requester = @Requester,
                            requester_email = @RequesterEmail,
                            assigned_to = @AssignedTo,
                            channel = @Channel,
                            native_sla_due_date = @NativeSlaDueDate,
                            updated_at = @UpdatedAt
                        WHERE freshdesk_id = @FreshdeskId AND source = 'Freshdesk'",
                        ticket);
                }
                else
                {
                    await connection.ExecuteAsync(@"
                        INSERT INTO incidentsandservice 
                        (freshdesk_id, title, description, status, priority, category, 
                         complexity, risk, delivery_points, sla_due_date, sla_breach, 
                         ticket_type, support_level, team, source, requester, requester_email, 
                         assigned_to, channel, native_sla_due_date, created_at, updated_at)
                        VALUES 
                        (@FreshdeskId, @Title, @Description, @Status, @Priority, @Category, 
                         @Complexity, @Risk, @DeliveryPoints, @SlaDueDate, @SlaBreach, 
                         @TicketType, @SupportLevel, @Team, @Source, @Requester, @RequesterEmail, 
                         @AssignedTo, @Channel, @NativeSlaDueDate, @CreatedAt, @UpdatedAt)",
                        ticket);
                }
            }
            
            _logger.LogInformation("Synced {Count} Freshdesk tickets (new + updated)", freshTickets.Count);
        }

        private async Task CleanupOldTickets(NpgsqlConnection connection)
        {
            var currentYearStart = new DateTime(DateTime.UtcNow.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var deletedCount = await connection.ExecuteAsync(
                "DELETE FROM incidentsandservice WHERE created_at < @CurrentYearStart",
                new { CurrentYearStart = currentYearStart });
            
            if (deletedCount > 0)
            {
                _logger.LogInformation("Deleted {Count} service requests older than 7 days", deletedCount);
            }
        }

        private async Task UpdateAllSlaBreachStatuses(NpgsqlConnection connection)
        {
            // First, copy native_sla_due_date to sla_due_date if sla_due_date is null
            await connection.ExecuteAsync(@"
                UPDATE incidentsandservice 
                SET sla_due_date = native_sla_due_date 
                WHERE sla_due_date IS NULL AND native_sla_due_date IS NOT NULL");
            
            // Then update breach statuses
            var updatedCount = await connection.ExecuteAsync(@"
                UPDATE incidentsandservice 
                SET sla_breach = CASE 
                    WHEN sla_due_date IS NOT NULL AND sla_due_date < @CurrentTime THEN true 
                    ELSE false 
                END",
                new { CurrentTime = DateTime.UtcNow });
            
            if (updatedCount > 0)
            {
                _logger.LogInformation("Updated SLA breach status for {Count} tickets", updatedCount);
            }
        }

        [HttpPost("update-sla-breaches")]
        public async Task<ActionResult> UpdateSlaBreaches()
        {
            using var connection = new NpgsqlConnection(_connectionString);
            
            // Copy native_sla_due_date to sla_due_date if needed
            var copiedCount = await connection.ExecuteAsync(@"
                UPDATE incidentsandservice 
                SET sla_due_date = native_sla_due_date 
                WHERE sla_due_date IS NULL AND native_sla_due_date IS NOT NULL");
            
            // Update breach statuses
            var updatedCount = await connection.ExecuteAsync(@"
                UPDATE incidentsandservice 
                SET sla_breach = CASE 
                    WHEN sla_due_date IS NOT NULL AND sla_due_date < @CurrentTime THEN true 
                    ELSE false 
                END",
                new { CurrentTime = DateTime.UtcNow });
            
            return Ok(new { 
                message = "Updated all SLA breach statuses", 
                copiedSlaDates = copiedCount,
                updatedBreachFlags = updatedCount
            });
        }

        [HttpPost("incidents")]
        public async Task<ActionResult<Incident>> CreateIncident([FromBody] CreateIncidentRequest request)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            
            var deliveryPoints = (request.Complexity + request.Risk) * 5;
            var slaDueDate = CalculateSlaDueDate(request.Priority);

            var sql = @"
                INSERT INTO incidentsandservice (title, description, status, priority, category, requester, 
                                     assigned_to, complexity, risk, delivery_points, sla_due_date, 
                                     sla_breach, ticket_type, support_level, source, created_at, updated_at)
                VALUES (@Title, @Description, 0, @Priority, @Category, @Requester, @AssignedTo, 
                        @Complexity, @Risk, @DeliveryPoints, @SlaDueDate, false, 'Incident', 'L1', 'Freshdesk', NOW(), NOW())
                RETURNING id, title, description, status, priority, category, requester, assigned_to, 
                          complexity, risk, delivery_points, sla_due_date, sla_breach, ticket_type, support_level, source, created_at, updated_at";

            var incident = await connection.QuerySingleAsync<Incident>(sql, new
            {
                request.Title,
                request.Description,
                request.Priority,
                request.Category,
                request.Requester,
                request.AssignedTo,
                request.Complexity,
                request.Risk,
                DeliveryPoints = deliveryPoints,
                SlaDueDate = slaDueDate
            });

            return CreatedAtAction(nameof(CreateIncident), new { id = incident.Id }, incident);
        }

        [HttpPost("service-requests")]
        public async Task<ActionResult<ServiceRequest>> CreateServiceRequest([FromBody] CreateServiceRequestRequest request)
        {
            using var connection = new NpgsqlConnection(_connectionString);
            
            var deliveryPoints = (request.Complexity + request.Risk) * 5;
            var slaDueDate = CalculateSlaDueDate(request.Priority);

            var sql = @"
                INSERT INTO incidentsandservice (title, description, status, priority, category, requester, 
                                            assigned_to, complexity, risk, delivery_points, sla_due_date, 
                                            sla_breach, ticket_type, support_level, source, created_at, updated_at)
                VALUES (@Title, @Description, 0, @Priority, @Category, @Requester, @AssignedTo, 
                        @Complexity, @Risk, @DeliveryPoints, @SlaDueDate, false, 'Service Request', 'L1', 'Freshdesk', NOW(), NOW())
                RETURNING id, title, description, status, priority, category, requester, assigned_to, 
                          complexity, risk, delivery_points, sla_due_date, sla_breach, ticket_type, support_level, source, created_at, updated_at";

            var serviceRequest = await connection.QuerySingleAsync<ServiceRequest>(sql, new
            {
                request.Title,
                request.Description,
                request.Priority,
                request.Category,
                request.Requester,
                request.AssignedTo,
                request.Complexity,
                request.Risk,
                DeliveryPoints = deliveryPoints,
                SlaDueDate = slaDueDate
            });

            return CreatedAtAction(nameof(CreateServiceRequest), new { id = serviceRequest.Id }, serviceRequest);
        }

        [HttpPost("fix-freshdesk-categorization")]
        public async Task<ActionResult> FixFreshdeskCategorization()
        {
            using var connection = new NpgsqlConnection(_connectionString);
            
            // Fix Freshdesk: L1 + Service Request (Contact Center is always L1)
            var freshdeskUpdated = await connection.ExecuteAsync(
                "UPDATE incidentsandservice SET ticket_type = 'Service Request', support_level = 'L1' WHERE source = 'Freshdesk'");
            
            // For Freshservice, we now rely on the categorization service during sync.
            // This method should only reset items that have NO level.
            var freshserviceUpdated = await connection.ExecuteAsync(
                "UPDATE incidentsandservice SET support_level = 'L2' WHERE source = 'Freshservice' AND (support_level IS NULL OR support_level = '')");
            
            return Ok(new { 
                message = "Fixed categorization", 
                freshdeskFixed = freshdeskUpdated,
                freshserviceFixed = freshserviceUpdated
            });
        }


        private DateTime CalculateSlaDueDate(string priority)
        {
            return priority switch
            {
                "Critical" => DateTime.Now.AddHours(4),
                "High" => DateTime.Now.AddHours(24),
                "Medium" => DateTime.Now.AddHours(72),
                "Low" => DateTime.Now.AddHours(168),
                _ => DateTime.Now.AddHours(72)
            };
        }
    }
}
