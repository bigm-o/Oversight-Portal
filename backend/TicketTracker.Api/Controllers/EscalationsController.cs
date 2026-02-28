using Microsoft.AspNetCore.Mvc;
using TicketTracker.Api.Models.Entities;
using TicketTracker.Api.Services.Interfaces;
using TicketTracker.Api.Services.Implementation;

namespace TicketTracker.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class EscalationsController : ControllerBase
    {
        private readonly IDatabaseService _databaseService;
        private readonly FreshserviceService _freshserviceService;
        private readonly ISyncStatusService _statusService;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<EscalationsController> _logger;

        public EscalationsController(
            IDatabaseService databaseService, 
            FreshserviceService freshserviceService, 
            ISyncStatusService statusService,
            IServiceScopeFactory scopeFactory,
            ILogger<EscalationsController> logger)
        {
            _databaseService = databaseService;
            _freshserviceService = freshserviceService;
            _statusService = statusService;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        [HttpGet]
        public async Task<IActionResult> GetEscalations([FromQuery] string? fromLevel = null, [FromQuery] string? toLevel = null, [FromQuery] DateTime? startDate = null, [FromQuery] DateTime? endDate = null)
        {
            try
            {
                // Fetch escalation records
                var records = await _databaseService.GetEscalationRecordsAsync(fromLevel: fromLevel, toLevel: toLevel, startDate: startDate, endDate: endDate);
                
                return Ok(records.OrderByDescending(e => e.EscalatedAt).ToList());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching escalations");
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpGet("{externalId}/journey")]
        public async Task<IActionResult> GetEscalationJourney(string externalId)
        {
            try
            {
                var journey = await _databaseService.GetServiceRequestMovementsAsync(externalId);
                
                // If local journey is empty, try to reconstruct it from Freshservice activities
                if (journey == null || journey.Count == 0)
                {
                    _logger.LogInformation("No local movements for {ExternalId}, attempting to reconstruct from Freshservice", externalId);
                    
                    var ticket = await _databaseService.GetServiceRequestByExternalIdAsync(externalId);
                    if (ticket != null)
                    {
                        var reconstructed = await _freshserviceService.GetTicketActivitiesAsync(externalId, ticket.Id, ticket.SupportLevel);
                        if (reconstructed != null && reconstructed.Count > 0)
                        {
                            foreach (var move in reconstructed)
                            {
                                await _databaseService.CreateServiceRequestMovementAsync(move);
                            }
                            journey = reconstructed;
                        }
                    }
                }
                
                return Ok(journey);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching escalation journey for {ExternalId}", externalId);
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpGet("stats")]
        public async Task<IActionResult> GetEscalationStats([FromQuery] string? fromLevel = null, [FromQuery] string? toLevel = null, [FromQuery] DateTime? startDate = null, [FromQuery] DateTime? endDate = null)
        {
            try
            {
                var records = await _databaseService.GetEscalationRecordsAsync(fromLevel: fromLevel, toLevel: toLevel, startDate: startDate, endDate: endDate);
                
                var stats = new
                {
                    totalEscalations = records.Count,
                    byLevel = records.GroupBy(e => e.ToLevel)
                                   .Select(g => new { level = g.Key, count = g.Count() }),
                    byTeam = records.GroupBy(e => e.AssignedTeam ?? "Unassigned")
                                  .Select(g => new { team = g.Key, count = g.Count() }),
                    slaBreached = records.Count(e => e.SlaBreach)
                };
                
                return Ok(stats);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching escalation stats");
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpPost("sync")]
        public IActionResult ManualSync()
        {
            var jobId = _statusService.StartJob("Escalations");

            _ = Task.Run(async () =>
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var dbService = scope.ServiceProvider.GetRequiredService<IDatabaseService>();
                    
                    _statusService.UpdateStatus(jobId, Services.Interfaces.SyncStatus.Running, "Syncing escalations from movements...", 20);
                    var count = await dbService.SyncEscalationsFromMovementsAsync();
                    
                    _statusService.UpdateStatus(jobId, Services.Interfaces.SyncStatus.Running, "Finalizing sync...", 80);
                    _statusService.UpdateStatus(jobId, Services.Interfaces.SyncStatus.Completed, $"Successfully synced {count} escalation records.");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Background escalation sync failed");
                    _statusService.UpdateStatus(jobId, Services.Interfaces.SyncStatus.Failed, $"Sync failed: {ex.Message}");
                }
            });

            return Ok(new { message = "Sync started in background", jobId });
        }
    }
}
