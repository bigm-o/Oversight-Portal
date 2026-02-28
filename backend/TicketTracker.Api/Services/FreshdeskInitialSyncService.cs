using TicketTracker.Api.Services.Interfaces;
using TicketTracker.Api.Services.Implementation;

namespace TicketTracker.Api.Services;

public class FreshdeskInitialSyncService : IHostedService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IConfiguration _configuration;
    private readonly ILogger<FreshdeskInitialSyncService> _logger;

    public FreshdeskInitialSyncService(
        IServiceProvider serviceProvider,
        IConfiguration configuration,
        ILogger<FreshdeskInitialSyncService> logger)
    {
        _serviceProvider = serviceProvider;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var freshdeskEnabled = _configuration["FRESHDESK_ENABLED"] == "true";
        var freshserviceEnabled = _configuration["FRESHSERVICE_ENABLED"] == "true";
        
        if (!freshdeskEnabled && !freshserviceEnabled)
        {
            _logger.LogInformation("Freshdesk/Freshservice integration disabled");
            return;
        }

        _logger.LogInformation("🚀 Starting Freshdesk/Freshservice initial sync...");

        try
        {
            using var scope = _serviceProvider.CreateScope();
            var databaseService = scope.ServiceProvider.GetRequiredService<IDatabaseService>();

            // Sync Freshdesk Incidents
            if (freshdeskEnabled)
            {
                var freshdeskService = scope.ServiceProvider.GetRequiredService<FreshdeskService>();
                var incidents = await freshdeskService.SyncCurrentYearAsync();
                
                _logger.LogInformation("✅ Found {Count} incidents from Freshdesk", incidents.Count);

                foreach (var incident in incidents)
                {
                    try
                    {
                        _logger.LogInformation("  ✅ Incident: {Id} - {Title}", incident.FreshdeskId, incident.Title);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to sync incident {Id}", incident.FreshdeskId);
                    }
                }
            }

            // Sync Freshservice Service Requests
            if (freshserviceEnabled)
            {
                var freshserviceService = scope.ServiceProvider.GetRequiredService<FreshserviceService>();
                var serviceRequests = await freshserviceService.SyncCurrentYearAsync();
                
                _logger.LogInformation("✅ Found {Count} service requests from Freshservice", serviceRequests.Count);

                foreach (var sr in serviceRequests)
                {
                    try
                    {
                        // TODO: Add GetServiceRequestByFreshdeskIdAsync to database service
                        _logger.LogInformation("  ✅ Service Request: {Id} - {Title}", sr.FreshdeskId, sr.Title);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to sync service request {Id}", sr.FreshdeskId);
                    }
                }
            }

            _logger.LogInformation("🎉 Freshdesk/Freshservice sync completed!");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Freshdesk/Freshservice sync failed");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}
