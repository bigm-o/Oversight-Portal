using Microsoft.AspNetCore.Mvc;
using TicketTracker.Api.Services.Interfaces;
using TicketTracker.Api.Services.Implementation;
using System.Linq;

namespace TicketTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class JiraController : ControllerBase
{
    private readonly IJiraService _jiraService;
    private readonly IDatabaseService _databaseService;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ISyncStatusService _statusService;
    private readonly ILogger<JiraController> _logger;

    public JiraController(IJiraService jiraService, IDatabaseService databaseService, IServiceScopeFactory scopeFactory, ISyncStatusService statusService, ILogger<JiraController> logger)
    {
        _jiraService = jiraService;
        _databaseService = databaseService;
        _scopeFactory = scopeFactory;
        _statusService = statusService;
        _logger = logger;
    }


    [HttpPost("init-schema")]
    public async Task<IActionResult> InitializeSchema()
    {
        await _databaseService.InitializeJiraSchemaAsync();
        return Ok("Jira schema initialized");
    }

    [HttpGet("test")]

    public async Task<IActionResult> TestConnection()
    {
        try
        {
            var isAuthenticated = await _jiraService.AuthenticateAsync();
            return Ok(new { authenticated = isAuthenticated, message = "JIRA OAuth connection successful" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "JIRA connection test failed");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("status")]
    public async Task<IActionResult> GetJiraStatus()
    {
        try
        {
            if (_jiraService is JiraService realJiraService)
            {
                var coreProjectKeys = new HashSet<string> { "SKP", "IR", "CAS", "CASP", "BARP3" };
                var allProjects = await realJiraService.GetProjectsAsync();
                var projects = allProjects.Where(p => !string.IsNullOrEmpty(p.key) && coreProjectKeys.Contains(p.key.ToUpper())).ToList();
                
                var projectDetails = new List<object>();
                int totalTicketsCount = 0;

                foreach (var project in projects)
                {
                    var projectTickets = await _jiraService.GetTicketsAsync(project.key ?? "");
                    totalTicketsCount += projectTickets.Count;
                    
                    projectDetails.Add(new
                    {
                        key = project.key,
                        name = project.name,
                        style = project.style,
                        ticketCount = projectTickets.Count,
                        tickets = projectTickets.Select(t => new { t.JiraKey, t.Title, Status = t.Status.ToString() }).Take(5)
                    });
                }

                return Ok(new
                {
                    connected = true,
                    totalProjects = projects.Count,
                    totalTickets = totalTicketsCount,
                    projects = projectDetails,
                    timestamp = DateTime.UtcNow
                });
            }
            
            return Ok(new { connected = false, message = "Using mock JIRA service" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get JIRA status");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("tickets")]
    public async Task<IActionResult> GetTickets([FromQuery] string? projectKey = null)
    {
        try
        {
            var tickets = await _jiraService.GetTicketsAsync(projectKey ?? "");
            return Ok(new { count = tickets.Count, tickets });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get tickets");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("tickets/{jiraKey}")]
    public async Task<IActionResult> GetTicket(string jiraKey)
    {
        try
        {
            var ticket = await _jiraService.GetTicketAsync(jiraKey);
            if (ticket == null)
            {
                return NotFound(new { error = $"Ticket {jiraKey} not found" });
            }
            return Ok(ticket);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get ticket {JiraKey}", jiraKey);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("projects")]
    public async Task<IActionResult> GetJiraProjectSources()
    {
        try
        {
            var sources = await _databaseService.GetAllJiraProjectSourcesAsync();
            return Ok(sources);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get Jira project sources");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("mapping")]
    public async Task<IActionResult> UpdateProjectMapping([FromBody] UpdateMappingRequest request)
    {
        try
        {
            // Verify source exists
            var existing = (await _databaseService.GetAllJiraProjectSourcesAsync())
                           .FirstOrDefault(p => (string)p.jira_key == request.JiraKey);
            
            if (existing == null) return NotFound(new { error = "Jira Project not found" });

            // Update mapping
            await _databaseService.UpsertJiraProjectSourceAsync(
                request.JiraKey, 
                (string)existing.jira_name, 
                (string)existing.category, 
                request.TeamId
            );

            // Trigger sync for this specific project to move tickets? 
            // Ideally we should full sync or sync just this project.
            // For now, let's keep it simple: just update mapping. The next sync will fix data.
            
            return Ok(new { message = "Mapping updated" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update mapping for {JiraKey}", request.JiraKey);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("sync")]
    public async Task<IActionResult> TriggerManualSync()
    {
        try
        {
            _logger.LogInformation("Triggering manual sync from API");
            // Create a job first to track status
            var jobId = _statusService.StartJob("JIRA (Full)");
            
            // Run in background with a new scope to avoid disposal
            _ = Task.Run(async () => {
                try 
                {
                    using var scope = _scopeFactory.CreateScope();
                    var syncService = scope.ServiceProvider.GetRequiredService<IJiraSyncService>();
                    await syncService.SyncAllProjectsAsync(jobId);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Background sync failed");
                    _statusService.UpdateStatus(jobId, SyncStatus.Failed, $"Sync failed: {ex.Message}");
                }
            });
            return Ok(new { message = "Sync started in background", jobId });
        }
        catch (Exception ex)
        {
             return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("sync-sprint-board")]
    public async Task<IActionResult> TriggerSprintBoardSync([FromQuery] int teamId, [FromQuery] string projectKey)
    {
        try
        {
            _logger.LogInformation("Triggering manual sprint board sync for team {TeamId}, project {ProjectKey}", teamId, projectKey);
            var jobId = _statusService.StartJob($"Sprint Board ({projectKey})");
            
            _ = Task.Run(async () => {
                try 
                {
                    using var scope = _scopeFactory.CreateScope();
                    var syncService = scope.ServiceProvider.GetRequiredService<IJiraSyncService>();
                    await syncService.SyncSprintBoardAsync(teamId, projectKey, jobId);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Background sprint board sync failed");
                    _statusService.UpdateStatus(jobId, SyncStatus.Failed, $"Sync failed: {ex.Message}");
                }
            });
            return Ok(new { message = "Sprint board sync started", jobId });
        }
        catch (Exception ex)
        {
             return StatusCode(500, new { error = ex.Message });
        }
    }



    public class UpdateMappingRequest
    {
        public string JiraKey { get; set; } = string.Empty;
        public int? TeamId { get; set; }
    }
}
