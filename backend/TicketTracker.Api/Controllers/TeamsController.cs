using Microsoft.AspNetCore.Mvc;
using TicketTracker.Api.Services.Interfaces;

namespace TicketTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TeamsController : ControllerBase
{
    private readonly IJiraService _jiraService;
    private readonly IDatabaseService _databaseService;
    private readonly IJiraSyncService _jiraSyncService;
    private readonly ILogger<TeamsController> _logger;

    private readonly ISyncStatusService _statusService;
    private readonly IServiceScopeFactory _scopeFactory;

    public TeamsController(IJiraService jiraService, IDatabaseService databaseService, IJiraSyncService jiraSyncService, ISyncStatusService statusService, IServiceScopeFactory scopeFactory, ILogger<TeamsController> logger)
    {
        _jiraService = jiraService;
        _databaseService = databaseService;
        _jiraSyncService = jiraSyncService;
        _statusService = statusService;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetTeams()
    {
        try
        {
            // Fetch all tickets from database
            var allTickets = await _databaseService.GetTicketsAsync();
            _logger.LogInformation("Retrieved {Count} tickets from database", allTickets.Count);

            // Fetch all DB projects
            var allProjects = await _databaseService.GetAllProjectsAsync();

            // Fetch teams from Database
            var dbTeams = await _databaseService.GetTeamsAsync();

            // Fetch sprint ticket counts
            var sprintCounts = await _databaseService.GetSprintTicketCountsAsync();

            // Map teams with their DB data
            var teams = dbTeams.Select(team =>
            {
                // Filter tickets that belong to this team's projects
                var teamProjects = allProjects.Where(p => p.TeamId == team.Id).ToList();
                var teamProjectIds = teamProjects.Select(p => p.Id).ToHashSet();
                
                // Only count tickets that actually belong to projects in this team
                var teamTickets = allTickets.Where(t => t.ProjectId.HasValue && teamProjectIds.Contains(t.ProjectId.Value)).ToList();
                
                var jiraProject = allProjects.FirstOrDefault(p => p.TeamId == team.Id); 
                
                // Sprint count from live board
                sprintCounts.TryGetValue(team.Id, out int sprintTicketCount);
                // Calculate metrics
                var openTickets = teamTickets.Count(t => t.Status != Models.Enums.TicketStatus.LIVE && t.Status != Models.Enums.TicketStatus.ROLLBACK);
                var inProgress = teamTickets.Count(t => (int)t.Status >= 1 && (int)t.Status <= 10);
                var completed = teamTickets.Count(t => t.Status == Models.Enums.TicketStatus.LIVE);
                
                // Calculate delivery points
                var totalPoints = teamTickets.Sum(t => t.DeliveryPoints);
                var completedPoints = teamTickets.Where(t => t.Status == Models.Enums.TicketStatus.LIVE).Sum(t => t.DeliveryPoints);
                
                // Calculate SLA breaches 
                var breaches = teamTickets.Count(t => t.Status != Models.Enums.TicketStatus.LIVE && (DateTime.UtcNow - t.CreatedAt).TotalDays > 14);

                // For headcounts, use the database-stored member count
                // The distinct JIRA assignees can be shown as "Active JIRA users" if needed elsewhere
                
                // Projects belonging to this team
                return new
                {
                    id = team.Id,
                    name = team.Name, 
                    lead = team.Lead,
                    members = team.Members, 
                    activeSprint = "Delivery Progress", 
                    sprintTicketCount = sprintTicketCount,
                    sprintStart = new DateTime(2025, 2, 1),
                    sprintEnd = new DateTime(2025, 2, 14),
                    
                    // JIRA Project Info
                    jiraProjectKey = team.ProjectKey,
                    jiraProjectName = jiraProject?.Name ?? team.Name, 
                    jiraProjectId = jiraProject?.Id,
                    hasJiraProject = jiraProject != null,
                    
                    // Real Metrics
                    totalTickets = teamTickets.Count(), 
                    completedTickets = completed, 
                    openTickets = openTickets,
                    inProgress = inProgress,
                    
                    totalProjects = teamProjects.Count,
                    
                    slaBreaches = breaches,
                    deliveryEfficiency = teamTickets.Count > 0 ? Math.Round((double)completed / teamTickets.Count * 100, 1) : 0,
                    
                    // Points for progress bar
                    totalPoints = totalPoints,
                    completedPoints = completedPoints,
                    
                    // Projects belonging to this team
                    projects = teamProjects.Select(p => new {
                        id = p.Id,
                        name = p.Name,
                        jiraKey = p.JiraKey,
                        teamId = p.TeamId,
                        totalTickets = teamTickets.Count(t => t.ProjectId == p.Id),
                        completedTickets = teamTickets.Count(t => t.ProjectId == p.Id && t.Status == Models.Enums.TicketStatus.LIVE),
                        plannedPoints = teamTickets.Where(t => t.ProjectId == p.Id).Sum(t => t.DeliveryPoints),
                        completedPoints = teamTickets.Where(t => t.ProjectId == p.Id && t.Status == Models.Enums.TicketStatus.LIVE).Sum(t => t.DeliveryPoints),
                        lead = p.Lead,
                        status = p.Status
                    }).OrderByDescending(p => p.totalTickets)
                      .ToList()
                };
            }).ToList();

            _logger.LogInformation("Returning {Count} teams with aggregated database metrics", teams.Count());
            return Ok(teams);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving teams data");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPut("{teamId}")]
    public async Task<IActionResult> UpdateTeam(int teamId, [FromBody] Models.Entities.Team updatedTeam)
    {
        try
        {
            var existingTeam = await _databaseService.GetTeamByIdAsync(teamId);
            if (existingTeam == null) return NotFound("Team not found");

            _logger.LogInformation("Updating team {TeamId}. New Name: {Name}, Lead: {Lead}, Members: {Members}", teamId, updatedTeam?.Name, updatedTeam?.Lead, updatedTeam?.Members);

            // Only update allowed fields from Settings UI
            existingTeam.Lead = updatedTeam.Lead;
            existingTeam.Members = updatedTeam.Members;
            existingTeam.Name = updatedTeam.Name;

            var success = await _databaseService.UpdateTeamAsync(existingTeam);
            if (!success) 
            {
                _logger.LogWarning("Database update failed for team {TeamId}", teamId);
                return StatusCode(500, "Failed to update team in database");
            }

            return Ok(existingTeam);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating team {TeamId}", teamId);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("sync")]
    public async Task<IActionResult> SyncJiraData()
    {
        try
        {
            _logger.LogInformation("Starting manual JIRA sync from Teams Dashboard");
            var jobId = _statusService.StartJob("JIRA (Full)");
            
            _ = Task.Run(async () => {
                try 
                {
                    using var scope = _scopeFactory.CreateScope();
                    var syncService = scope.ServiceProvider.GetRequiredService<IJiraSyncService>();
                    await syncService.SyncAllProjectsAsync(jobId);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Background JIRA sync failed");
                    _statusService.UpdateStatus(jobId, SyncStatus.Failed, $"Sync failed: {ex.Message}");
                }
            });

            return Ok(new { message = "Sync started in background", jobId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to trigger JIRA sync");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("{teamId}/tickets")]
    public async Task<IActionResult> GetTeamTickets(int teamId)
    {
        try
        {
            var allTickets = await _databaseService.GetTicketsAsync();
            var teamTickets = allTickets.Where(t => t.ProjectId == teamId).ToList();
            return Ok(teamTickets);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving tickets for team {TeamId}", teamId);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("{teamId}/metrics")]
    public async Task<IActionResult> GetTeamMetrics(int teamId)
    {
        try
        {
            var allTickets = await _databaseService.GetTicketsAsync();
            var teamTickets = allTickets.Where(t => t.ProjectId == teamId).ToList();
            
                // Calculate metrics
                var openTickets = teamTickets.Count(t => t.Status != Models.Enums.TicketStatus.LIVE && t.Status != Models.Enums.TicketStatus.ROLLBACK);
                var inProgress = teamTickets.Count(t => (int)t.Status >= 1 && (int)t.Status <= 10);
                var completed = teamTickets.Count(t => t.Status == Models.Enums.TicketStatus.LIVE);
                
                // Calculate delivery points
                var totalPoints = teamTickets.Sum(t => t.DeliveryPoints);
                var completedPoints = teamTickets.Where(t => t.Status == Models.Enums.TicketStatus.LIVE).Sum(t => t.DeliveryPoints);
                var efficiency = totalPoints > 0 ? (double)completedPoints / totalPoints * 100 : 0;
                
                // Calculate SLA breaches (mock based on CreatedAt for now since we don't have SLA due date in Ticket model yet)
                // Assuming 2 weeks SLA
                var breaches = teamTickets.Count(t => t.Status != Models.Enums.TicketStatus.LIVE && (DateTime.UtcNow - t.CreatedAt).TotalDays > 14);

            return Ok(new
            {
                team_id = teamId,
                total_tickets = teamTickets.Count,
                open_tickets = openTickets,
                in_progress = inProgress,
                completed_tickets = completed,
                sla_breaches = breaches,
                delivery_efficiency = Math.Round(efficiency, 1),
                planned_points = totalPoints,
                completed_points = completedPoints
            });
        }
        catch (Exception ex)
        {
             _logger.LogError(ex, "Error retrieving metrics for team {TeamId}", teamId);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("debug-schema")]
    public async Task<IActionResult> DebugSchema([FromQuery] string table = "tickets")
    {
        try 
        {
            var columns = await _databaseService.GetAllColumnsAsync(table);
            return Ok(columns);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("update-schema-projects")]
    public async Task<IActionResult> UpdateSchemaForProjects()
    {
        try 
        {
            var sql = @"
                ALTER TABLE projects ADD COLUMN IF NOT EXISTS jira_key TEXT;
                ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT;
                ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;
                ALTER TABLE projects ADD COLUMN IF NOT EXISTS lead TEXT;
                ALTER TABLE tickets ADD COLUMN IF NOT EXISTS epic_key TEXT;
            ";
            
            await _databaseService.ExecuteRawSqlAsync(sql);
            return Ok(new { message = "Schema updated for projects/epics successfully" });
        }
        catch (Exception ex)
        {
             _logger.LogError(ex, "Error updating schema for projects");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("init-jira-schema")]
    public async Task<IActionResult> InitJiraSchema()
    {
        try
        {
            await _databaseService.InitializeJiraSchemaAsync();
            return Ok(new { message = "Jira schema initialized successfully" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("update-points")]
    public async Task<IActionResult> UpdatePointsAndSchema()
    {
        try 
        {
            var sql = @"
                -- Add columns if not exist
                ALTER TABLE tickets ADD COLUMN IF NOT EXISTS complexity INT;
                ALTER TABLE tickets ADD COLUMN IF NOT EXISTS risk INT;

                -- Randomize data for existing tickets (only empty ones)
                UPDATE tickets 
                SET complexity = floor(random() * 4 + 1)::int
                WHERE complexity IS NULL OR complexity = 0;

                UPDATE tickets 
                SET risk = floor(random() * 4 + 1)::int
                WHERE risk IS NULL OR risk = 0;

                -- Calculate Delivery Points: 10 * (Risk + Complexity)
                UPDATE tickets
                SET delivery_points = 10 * (risk + complexity);
            ";
            
            await _databaseService.ExecuteRawSqlAsync(sql);
            return Ok(new { message = "Schema updated and points recalculated successfully" });
        }
        catch (Exception ex)
        {
             _logger.LogError(ex, "Error updating points schema");
            return StatusCode(500, new { error = ex.Message });
        }
    }
}
