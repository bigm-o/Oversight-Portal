using Microsoft.AspNetCore.Mvc;
using TicketTracker.Api.Models.Entities;
using TicketTracker.Api.Models.Enums;
using TicketTracker.Api.Services.Interfaces;

namespace TicketTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class IncidentsController : ControllerBase
{
    private readonly IDatabaseService _databaseService;
    private readonly IDeliveryPointsService _deliveryPointsService;
    private readonly ILogger<IncidentsController> _logger;

    public IncidentsController(
        IDatabaseService databaseService,
        IDeliveryPointsService deliveryPointsService,
        ILogger<IncidentsController> logger)
    {
        _databaseService = databaseService;
        _deliveryPointsService = deliveryPointsService;
        _logger = logger;
    }

    [HttpPost("sync-l4")]
    public async Task<IActionResult> SyncDevelopmentIncidents()
    {
        try
        {
            _logger.LogInformation("L4 Incident Sync requested via API");
            var success = await _databaseService.SyncDevelopmentIncidentsAsync();
            if (success)
                return Ok(new { message = "L4 Incidents synchronized successfully" });
            
            return StatusCode(500, "Failed to synchronize L4 incidents");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during L4 incident synchronization");
            return StatusCode(500, "Error during L4 incident synchronization");
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetIncidents()
    {
        try
        {
            var incidents = await _databaseService.GetIncidentsAsync();
            return Ok(incidents);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving incidents");
            return StatusCode(500, "Error retrieving incidents");
        }
    }

    [HttpGet("l4")]
    public async Task<IActionResult> GetDevelopmentIncidents([FromQuery] DateTime? startDate = null, [FromQuery] DateTime? endDate = null)
    {
        try
        {
            var incidents = await _databaseService.GetDevelopmentIncidentsAsync(startDate, endDate);
            return Ok(incidents);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving L4 incidents");
            return StatusCode(500, "Error retrieving L4 incidents");
        }
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetIncident(int id)
    {
        try
        {
            var incident = await _databaseService.GetIncidentByIdAsync(id);
            if (incident == null)
                return NotFound($"Incident with ID {id} not found");

            return Ok(incident);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving incident {IncidentId}", id);
            return StatusCode(500, "Error retrieving incident");
        }
    }

    [HttpPost]
    [Consumes("application/json")]
    public async Task<IActionResult> CreateIncident([FromBody] Incident incident)
    {
        try
        {
            // Calculate delivery points
            incident.DeliveryPoints = _deliveryPointsService.CalculateIncidentPoints(incident.Complexity, incident.Risk);
            
            var incidentId = await _databaseService.CreateIncidentAsync(incident);
            if (incidentId > 0)
            {
                var createdIncident = await _databaseService.GetIncidentByIdAsync(incidentId);
                return CreatedAtAction(nameof(GetIncident), new { id = incidentId }, createdIncident);
            }

            return BadRequest("Failed to create incident");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating incident");
            return StatusCode(500, "Error creating incident");
        }
    }

    [HttpPut("{id}")]
    [Consumes("application/json")]
    public async Task<IActionResult> UpdateIncident(int id, [FromBody] Incident incident)
    {
        try
        {
            if (id != incident.Id)
                return BadRequest("ID mismatch");

            // Recalculate delivery points if complexity or risk changed
            incident.DeliveryPoints = _deliveryPointsService.CalculateIncidentPoints(incident.Complexity, incident.Risk);

            var success = await _databaseService.UpdateIncidentAsync(incident);
            if (success)
                return Ok(incident);

            return NotFound($"Incident with ID {id} not found");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating incident {IncidentId}", id);
            return StatusCode(500, "Error updating incident");
        }
    }

    [HttpPatch("{id}/complexity")]
    public async Task<IActionResult> UpdateComplexity(int id, [FromBody] ComplexityLevel complexity)
    {
        try
        {
            var incident = await _databaseService.GetIncidentByIdAsync(id);
            if (incident == null)
                return NotFound($"Incident with ID {id} not found");

            incident.Complexity = complexity;
            incident.DeliveryPoints = _deliveryPointsService.CalculateIncidentPoints(incident.Complexity, incident.Risk);

            var success = await _databaseService.UpdateIncidentAsync(incident);
            if (success)
                return Ok(new { 
                    IncidentId = id, 
                    Complexity = complexity, 
                    DeliveryPoints = incident.DeliveryPoints 
                });

            return BadRequest("Failed to update complexity");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating complexity for incident {IncidentId}", id);
            return StatusCode(500, "Error updating complexity");
        }
    }

    [HttpPatch("{id}/risk")]
    public async Task<IActionResult> UpdateRisk(int id, [FromBody] RiskLevel risk)
    {
        try
        {
            var incident = await _databaseService.GetIncidentByIdAsync(id);
            if (incident == null)
                return NotFound($"Incident with ID {id} not found");

            incident.Risk = risk;
            incident.DeliveryPoints = _deliveryPointsService.CalculateIncidentPoints(incident.Complexity, incident.Risk);

            var success = await _databaseService.UpdateIncidentAsync(incident);
            if (success)
                return Ok(new { 
                    IncidentId = id, 
                    Risk = risk, 
                    DeliveryPoints = incident.DeliveryPoints 
                });

            return BadRequest("Failed to update risk");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating risk for incident {IncidentId}", id);
            return StatusCode(500, "Error updating risk");
        }
    }

    [HttpPatch("l4/{id}/team")]
    public async Task<IActionResult> UpdateL4Team(int id, [FromBody] TeamUpdateDto dto)
    {
        try
        {
            var success = await _databaseService.UpdateDevelopmentIncidentTeamAsync(id, dto.Team);
            if (success)
                return Ok(new { message = "Team updated successfully" });

            return BadRequest("Failed to update team");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating team for L4 incident {IncidentId}", id);
            return StatusCode(500, "Error updating team");
        }
    }

    [HttpPatch("l4-reassign/{id}")]
    public async Task<IActionResult> ReassignL4Level(int id, [FromBody] ReassignLevelDto dto)
    {
        try
        {
            _logger.LogInformation("Reassigning L4 incident {IncidentId} to level {Level}", id, dto.Level);
            var success = await _databaseService.ReassignDevelopmentIncidentLevelAsync(id, dto.Level);
            if (success)
            {
                _logger.LogInformation("Successfully reassigned L4 incident {IncidentId}", id);
                return Ok(new { message = $"Incident reassigned from L4 to {dto.Level}" });
            }

            _logger.LogWarning("Failed to reassign L4 incident {IncidentId}", id);
            return BadRequest("Failed to reassign incident level");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reassigning L4 incident {IncidentId} to level {Level}", id, dto.Level);
            return StatusCode(500, "Error reassigning incident level");
        }
    }
}

public class TeamUpdateDto
{
    public string Team { get; set; } = string.Empty;
}

public class ReassignLevelDto
{
    public string Level { get; set; } = string.Empty;
}