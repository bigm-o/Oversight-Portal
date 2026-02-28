using TicketTracker.Api.Services.Interfaces;
using TicketTracker.Api.Models.Entities;
using TicketTracker.Api.Models.Enums;

namespace TicketTracker.Api.Services.Implementation;

public class JiraSyncService : IJiraSyncService
{
    private readonly IJiraService _jiraService;
    private readonly IDatabaseService _databaseService;
    private readonly ISyncStatusService _statusService;
    private readonly ILogger<JiraSyncService> _logger;

    public JiraSyncService(IJiraService jiraService, IDatabaseService databaseService, ISyncStatusService statusService, ILogger<JiraSyncService> logger)
    {
        _jiraService = jiraService;
        _databaseService = databaseService;
        _statusService = statusService;
        _logger = logger;
    }

    public async Task SyncAllProjectsAsync(string jobId = null)
    {
        try
        {
            if (jobId != null) _statusService.UpdateStatus(jobId, SyncStatus.Running, "Starting fresh JIRA sync...", 5);
            
            await _databaseService.InitializeJiraSchemaAsync();
            
            // 1. Fetch ALL projects but FILTER to the 4 core spaces we track
            var allJiraProjects = await _jiraService.GetProjectsAsync();
            var coreProjectKeys = new HashSet<string> { "SKP", "IR", "CAS", "BARP3" };
            var jiraProjects = allJiraProjects
                .Where(p => !string.IsNullOrEmpty(p.key) && coreProjectKeys.Contains(p.key.ToUpper()))
                .ToList();
            
            _logger.LogInformation("Restricting sync to {Count} core agile projects: {Keys}", jiraProjects.Count, string.Join(", ", coreProjectKeys));

            var dbSources = (await _databaseService.GetAllJiraProjectSourcesAsync())
                            .ToDictionary(x => (string)x.jira_key, x => (int?)x.team_id);

            int processed = 0;
            foreach (var p in jiraProjects)
            {
                processed++;
                var progress = 10 + ((double)processed / jiraProjects.Count * 80);
                if (jobId != null) _statusService.UpdateStatus(jobId, SyncStatus.Running, $"Syncing project {p.key} ({processed}/{jiraProjects.Count})", progress);

                int? teamId = dbSources.TryGetValue(p.key, out var existing) ? existing : null;
                if (!teamId.HasValue)
                {
                    teamId = p.key switch { "SKP" => 1, "IR" => 2, "CAS" => 3, "CASP" => 3, "BARP3" => 4, _ => null };
                }

                try
                {
                    await _databaseService.UpsertJiraProjectSourceAsync(p.key, p.name ?? "Untitled", p.projectCategory?.name, teamId);
                    await SyncProjectInternalAsync(p.key, teamId, coreProjectKeys);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed sync for {Project}", p.key);
                }
            }

            if (jobId != null) _statusService.UpdateStatus(jobId, SyncStatus.Running, "Finalizing sync...", 95);
            await _databaseService.PurgeOldDataAsync();
            if (jobId != null) _statusService.UpdateStatus(jobId, SyncStatus.Completed, "JIRA sync finished. Only core agile teams (SKP, IR, CASP, BARP3) processed.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Full sync failed");
            if (jobId != null) _statusService.UpdateStatus(jobId, SyncStatus.Failed, $"Sync failed: {ex.Message}");
        }
    }

    public async Task SyncSprintBoardAsync(int teamId, string projectKey, string jobId = null)
    {
        try
        {
            if (jobId != null) _statusService.UpdateStatus(jobId, SyncStatus.Running, $"Fetching active sprint tickets for {projectKey}...", 10);
            
            var tickets = await _jiraService.GetActiveSprintTicketsAsync(projectKey, teamId);
            
            if (jobId != null) _statusService.UpdateStatus(jobId, SyncStatus.Running, $"Updating database with {tickets.Count} tickets...", 50);

            await _databaseService.ReplaceSprintBoardTicketsAsync(teamId, tickets);

            if (jobId != null) _statusService.UpdateStatus(jobId, SyncStatus.Completed, $"Successfully synced {tickets.Count} tickets for team {teamId} (Board: {projectKey}).");
            _logger.LogInformation("Successfully synced {Count} sprint board tickets for team {TeamId} project {ProjectName}", tickets.Count, teamId, projectKey);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to sync sprint board for team {TeamId} and project {ProjectKey}", teamId, projectKey);
            if (jobId != null) _statusService.UpdateStatus(jobId, SyncStatus.Failed, $"Sync failed: {ex.Message}");
            throw;
        }
    }


    private async Task SyncProjectInternalAsync(string projectKey, int? teamId, HashSet<string> coreProjectKeys)
    {
        // 1. Sync Tickets for THIS project only
        var tickets = await _jiraService.GetTicketsAsync(projectKey);
        if (!tickets.Any()) return;

        var epicIdCache = new Dictionary<string, int>();

        foreach (var t in tickets)
        {
            int? projectId = null;
            if (!string.IsNullOrEmpty(t.EpicKey))
            {
                if (!epicIdCache.TryGetValue(t.EpicKey, out var cachedId))
                {
                    var dbP = await _databaseService.GetProjectByJiraKeyAsync(t.EpicKey);
                    if (dbP != null)
                    {
                        projectId = dbP.Id;
                        epicIdCache[t.EpicKey] = dbP.Id;
                    }
                    else
                    {
                        // Discover the Epic and create as a Project
                        var discoveredEpic = await _jiraService.GetEpicFromIssueAsync(t.EpicKey);
                        if (discoveredEpic != null)
                        {
                            // Map project to the team of the space it was found in
                            if (teamId.HasValue) discoveredEpic.TeamId = teamId.Value;
                            
                            int newProjectId = await _databaseService.UpsertProjectAsync(discoveredEpic);
                            projectId = newProjectId;
                            epicIdCache[t.EpicKey] = newProjectId;
                            _logger.LogInformation("Discovered new Project from Ticket: {EpicKey} -> {ProjectName}", t.EpicKey, discoveredEpic.Name);
                        }
                    }
                }
                else
                {
                    projectId = cachedId;
                }
            }

            var dbTicket = new Ticket
            {
                JiraKey = t.JiraKey,
                EpicKey = t.EpicKey,
                Title = t.Title,
                Description = t.Description,
                Status = t.Status,
                ProjectId = projectId, // Can be null now
                AssignedTo = t.AssignedTo,
                CreatedAt = t.CreatedAt,
                UpdatedAt = t.JiraUpdatedAt ?? DateTime.UtcNow,
                JiraUpdatedAt = t.JiraUpdatedAt
            };

            int ticketId;
            var existing = await _databaseService.GetTicketByJiraKeyAsync(t.JiraKey);
            if (existing != null)
            {
                dbTicket.Id = existing.Id;
                dbTicket.IsManualProjectMap = existing.IsManualProjectMap;

                // Respect manual mapping: do not overwrite ProjectId if it was manually set
                if (existing.IsManualProjectMap)
                {
                    dbTicket.ProjectId = existing.ProjectId;
                }
                else if (!dbTicket.ProjectId.HasValue && existing.ProjectId.HasValue)
                {
                    dbTicket.ProjectId = existing.ProjectId;
                }
                
                await _databaseService.UpdateTicketAsync(dbTicket);
                ticketId = existing.Id;
            }
            else
            {
                ticketId = await _databaseService.CreateTicketAsync(dbTicket);
            }

            // 3. Sync History - Optimized to only fetch if JIRA has updates
            try
            {
                var existingMovesInDb = await _databaseService.GetTicketMovementsAsync(t.JiraKey);
                bool needsHistorySync = existing == null || 
                                      existingMovesInDb.Count == 0 ||
                                      t.JiraUpdatedAt == null || 
                                      existing.JiraUpdatedAt == null || 
                                      t.JiraUpdatedAt > existing.JiraUpdatedAt;

                if (needsHistorySync)
                {
                    var history = await _jiraService.GetTicketHistoryAsync(t.JiraKey);
                    var existingMoves = await _databaseService.GetTicketMovementsAsync(t.JiraKey);
                    foreach (var m in history)
                    {
                        if (!existingMoves.Any(em => em.FromStatus == m.FromStatus && em.ToStatus == m.ToStatus && Math.Abs((em.CreatedAt - m.CreatedAt).TotalSeconds) < 2))
                        {
                            m.TicketId = ticketId;
                            await _databaseService.CreateTicketMovementAsync(m);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("History sync failed for {Ticket}: {Msg}", t.JiraKey, ex.Message);
            }
        }
    }
}
