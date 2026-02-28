using TicketTracker.Api.Services.Interfaces;
using TicketTracker.Api.Services.Implementation;

namespace TicketTracker.Api.Services;

public class JiraInitialSyncService : IHostedService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IConfiguration _configuration;
    private readonly ILogger<JiraInitialSyncService> _logger;

    public JiraInitialSyncService(
        IServiceProvider serviceProvider,
        IConfiguration configuration,
        ILogger<JiraInitialSyncService> logger)
    {
        _serviceProvider = serviceProvider;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var jiraEnabled = _configuration["JIRA_ENABLED"] == "true";
        
        if (!jiraEnabled)
        {
            _logger.LogInformation("JIRA integration disabled - skipping initial sync");
            return;
        }

        _logger.LogInformation("🚀 Starting JIRA initial sync...");

        try
        {
            using var scope = _serviceProvider.CreateScope();
            var jiraService = scope.ServiceProvider.GetRequiredService<IJiraService>();
            var databaseService = scope.ServiceProvider.GetRequiredService<IDatabaseService>();
            
            if (jiraService is JiraService realJiraService)
            {
                // Get all projects from JIRA
                var projects = await realJiraService.GetProjectsAsync();
                _logger.LogInformation("✅ Found {Count} JIRA projects", projects.Count);

                // Sync each project to database as a team/project
                foreach (var project in projects)
                {
                    _logger.LogInformation("  📁 Syncing project: {Name} ({Key})", project.name, project.key);
                    
                    // Get tickets for this project
                    var tickets = await jiraService.GetTicketsAsync(project.key ?? "");
                    _logger.LogInformation("    🎫 Found {Count} tickets in {Key}", tickets.Count, project.key);
                    
                    // Save tickets to database
                    foreach (var ticket in tickets)
                    {
                        try
                        {
                            // Check if ticket already exists
                            var existing = await databaseService.GetTicketByJiraKeyAsync(ticket.JiraKey ?? "");
                            
                            if (existing == null)
                            {
                                // Create new ticket
                                ticket.ProjectId = 1; // Default project for now
                                await databaseService.CreateTicketAsync(ticket);
                                _logger.LogInformation("      ✅ Created ticket: {Key}", ticket.JiraKey);
                            }
                            else
                            {
                                // Update existing ticket
                                ticket.Id = existing.Id;
                                ticket.ProjectId = existing.ProjectId;
                                await databaseService.UpdateTicketAsync(ticket);
                                _logger.LogInformation("      🔄 Updated ticket: {Key}", ticket.JiraKey);
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Failed to sync ticket {Key}", ticket.JiraKey);
                        }
                    }
                }

                _logger.LogInformation("🎉 JIRA initial sync completed successfully!");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ JIRA initial sync failed");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}
