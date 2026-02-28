using TicketTracker.Api.Services.Interfaces;
using TicketTracker.Api.Models.Entities;
using Dapper;
using Npgsql;

namespace TicketTracker.Api.Services.Implementation;

public class BackgroundSyncService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<BackgroundSyncService> _logger;
    private readonly IConfiguration _configuration;
    private readonly string _connectionString;

    public BackgroundSyncService(
        IServiceProvider serviceProvider, 
        ILogger<BackgroundSyncService> logger,
        IConfiguration configuration)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _configuration = configuration;
        _connectionString = configuration.GetConnectionString("DefaultConnection") 
            ?? throw new InvalidOperationException("Connection string not found");
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Background sync service started");

        // Initial sync on startup
        await PerformSync();

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
                if (!stoppingToken.IsCancellationRequested)
                {
                    await PerformSync();
                }
            }
            catch (TaskCanceledException)
            {
                // Expected during shutdown, ignore
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in background sync service");
            }
        }
    }

    private async Task PerformSync()
    {
        using var scope = _serviceProvider.CreateScope();
        var databaseService = scope.ServiceProvider.GetRequiredService<IDatabaseService>();
        
        // Ensure schemas are initialized
        await databaseService.InitializeServiceRequestSchemaAsync();
        
        // Sync Freshservice (L2)
        if (_configuration["FRESHSERVICE_ENABLED"] == "true")
        {
            await SyncFreshservice(scope);
        }

        // Sync Freshdesk (L1)
        if (_configuration["FRESHDESK_ENABLED"] == "true")
        {
            await SyncFreshdesk(scope);
        }

        // Sync JIRA (when enabled)
        if (_configuration["JIRA_ENABLED"] == "true")
        {
            await SyncJira(scope);
        }

        // Populate specific escalations table from movements
        await databaseService.SyncEscalationsFromMovementsAsync();

        _logger.LogInformation("Background sync completed");
    }

    private async Task SyncFreshservice(IServiceScope scope)
    {
        try
        {
            var freshserviceService = scope.ServiceProvider.GetRequiredService<FreshserviceService>();
            var databaseService = scope.ServiceProvider.GetRequiredService<IDatabaseService>();
            var tickets = await freshserviceService.SyncCurrentYearAsync();
            
            foreach (var ticket in tickets)
            {
                ticket.Title = ticket.Title?.Replace("\0", "") ?? "";
                ticket.Description = ticket.Description?.Replace("\0", "") ?? "";
                ticket.Category = ticket.Category?.Replace("\0", "") ?? "";
                ticket.Requester = ticket.Requester?.Replace("\0", "") ?? "";
                ticket.AssignedTo = ticket.AssignedTo?.Replace("\0", "") ?? "";
                
                // Track Movement
                var existing = await databaseService.GetServiceRequestByExternalIdAsync(ticket.FreshdeskId!);
                int requestId = await databaseService.UpsertServiceRequestAsync(ticket);

                if (existing != null && (existing.SupportLevel != ticket.SupportLevel || existing.Status != ticket.Status))
                {
                    // Only record movements for UPWARD transitions (Sticky Tier logic)
                    if (GetLevelRank(ticket.SupportLevel) > GetLevelRank(existing.SupportLevel))
                    {
                        await databaseService.CreateServiceRequestMovementAsync(new ServiceRequestMovement
                        {
                            ServiceRequestId = requestId,
                            ExternalId = ticket.FreshdeskId!,
                            Source = ticket.Source,
                            FromLevel = existing.SupportLevel,
                            ToLevel = ticket.SupportLevel,
                            FromStatus = existing.Status.ToString(),
                            ToStatus = ticket.Status.ToString(),
                            ChangedBy = ticket.AssignedTo ?? "System Sync",
                            CreatedAt = ticket.UpdatedAt ?? DateTime.UtcNow
                        });
                    }
                }
            }
            
            _logger.LogInformation("Freshservice sync completed: {Count} tickets", tickets.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Freshservice sync failed");
            throw;
        }
    }

    private async Task SyncJira(IServiceScope scope)
    {
        try
        {
            var syncService = scope.ServiceProvider.GetRequiredService<IJiraSyncService>();
            await syncService.SyncAllProjectsAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "JIRA sync failed in background service");
        }
    }

    private async Task SyncFreshdesk(IServiceScope scope)
    {
        try
        {
            var freshdeskService = scope.ServiceProvider.GetRequiredService<FreshdeskService>();
            var databaseService = scope.ServiceProvider.GetRequiredService<IDatabaseService>();
            var tickets = await freshdeskService.SyncCurrentYearAsync();
            
            foreach (var ticket in tickets)
            {
                ticket.Title = ticket.Title?.Replace("\0", "") ?? "";
                ticket.Description = ticket.Description?.Replace("\0", "") ?? "";
                ticket.Category = ticket.Category?.Replace("\0", "") ?? "";
                ticket.Requester = ticket.Requester?.Replace("\0", "") ?? "";
                ticket.AssignedTo = ticket.AssignedTo?.Replace("\0", "") ?? "";
                
                // Track Movement
                var existing = await databaseService.GetServiceRequestByExternalIdAsync(ticket.FreshdeskId!);
                int requestId = await databaseService.UpsertServiceRequestAsync(ticket);

                if (existing != null && (existing.SupportLevel != ticket.SupportLevel || existing.Status != ticket.Status))
                {
                    // Only record movements for UPWARD transitions (Sticky Tier logic)
                    if (GetLevelRank(ticket.SupportLevel) > GetLevelRank(existing.SupportLevel))
                    {
                        await databaseService.CreateServiceRequestMovementAsync(new ServiceRequestMovement
                        {
                            ServiceRequestId = requestId,
                            ExternalId = ticket.FreshdeskId!,
                            Source = ticket.Source,
                            FromLevel = existing.SupportLevel,
                            ToLevel = ticket.SupportLevel,
                            FromStatus = existing.Status.ToString(),
                            ToStatus = ticket.Status.ToString(),
                            ChangedBy = ticket.AssignedTo ?? "System Sync",
                            CreatedAt = ticket.UpdatedAt ?? DateTime.UtcNow
                        });
                    }
                }
            }
            
            _logger.LogInformation("Freshdesk sync completed: {Count} tickets", tickets.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Freshdesk sync failed");
            throw;
        }
    }

    private int GetLevelRank(string? level) => level?.ToUpper() switch
    {
        "L4" => 4,
        "L3" => 3,
        "L2" => 2,
        "L1" => 1,
        _ => 0
    };
}