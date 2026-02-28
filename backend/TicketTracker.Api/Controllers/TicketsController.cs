using Microsoft.AspNetCore.Mvc;
using TicketTracker.Api.Models.Entities;
using TicketTracker.Api.Models.Enums;
using TicketTracker.Api.Services.Interfaces;

namespace TicketTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TicketsController : ControllerBase
{
    private readonly IDatabaseService _databaseService;
    private readonly IJiraService _jiraService;
    private readonly IDeliveryPointsService _deliveryPointsService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TicketsController> _logger;

    public TicketsController(
        IDatabaseService databaseService,
        IJiraService jiraService,
        IDeliveryPointsService deliveryPointsService,
        IConfiguration configuration,
        ILogger<TicketsController> logger)
    {
        _databaseService = databaseService;
        _jiraService = jiraService;
        _deliveryPointsService = deliveryPointsService;
        _configuration = configuration;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetTickets([FromQuery] string? team = null, [FromQuery] string? institution = null, [FromQuery] string? priority = null, [FromQuery] DateTime? startDate = null, [FromQuery] DateTime? endDate = null)
    {
        try
        {
            var tickets = await _databaseService.GetTicketsAsync(startDate, endDate);
            
            var filtered = tickets.AsEnumerable();
            if (!string.IsNullOrEmpty(team) && team != "All Teams")
                filtered = filtered.Where(t => t.Team == team);
                
            return Ok(filtered.ToList());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving tickets");
            return StatusCode(500, "Error retrieving tickets");
        }
    }

    [HttpGet("sprint-board")]
    public async Task<IActionResult> GetSprintBoard([FromQuery] int teamId)
    {
        try
        {
            var tickets = await _databaseService.GetSprintBoardTicketsAsync(teamId);
            return Ok(tickets);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving sprint board tickets");
            return StatusCode(500, "Error retrieving sprint board tickets");
        }
    }

    [HttpGet("movements")]
    public async Task<IActionResult> GetAllMovements([FromQuery] string? jiraKey = null, [FromQuery] DateTime? startDate = null, [FromQuery] DateTime? endDate = null)
    {
        try
        {
            var movements = await _databaseService.GetTicketMovementsAsync(jiraKey, startDate, endDate);
            return Ok(movements);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving ticket movements");
            return StatusCode(500, "Error retrieving ticket movements");
        }
    }

    [HttpGet("rollbacks")]
    public async Task<IActionResult> GetRollbacks([FromQuery] DateTime? startDate = null, [FromQuery] DateTime? endDate = null)
    {
        try
        {
            var allMovements = await _databaseService.GetTicketMovementsAsync(null, startDate, endDate);
            var rollbacks = allMovements.Where(m => m.IsRollback).ToList();
            return Ok(rollbacks);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving rollbacks");
            return StatusCode(500, "Error retrieving rollbacks");
        }
    }

    [HttpPatch("movements/{id}/justification")]
    [Consumes("application/json")]
    public async Task<IActionResult> UpdateMovementJustification(int id, [FromBody] TicketMovementJustificationRequest request)
    {
        try
        {
            if (request == null || string.IsNullOrEmpty(request.Justification))
                return BadRequest("Justification text is required");

            var success = await _databaseService.UpdateMovementJustificationAsync(id, request.Justification, request.JustifiedBy ?? "System");
            if (success)
                return Ok(new { Message = "Justification updated" });

            return NotFound($"Movement with ID {id} not found");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating justification for movement {MovementId}", id);
            return StatusCode(500, "Error updating justification");
        }
    }



    [HttpGet("{id}")]
    public async Task<IActionResult> GetTicket(int id)
    {
        try
        {
            var ticket = await _databaseService.GetTicketByIdAsync(id);
            if (ticket == null)
                return NotFound($"Ticket with ID {id} not found");

            return Ok(ticket);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving ticket {TicketId}", id);
            return StatusCode(500, "Error retrieving ticket");
        }
    }

    [HttpGet("jira/{jiraKey}")]
    public async Task<IActionResult> GetTicketByJiraKey(string jiraKey)
    {
        try
        {
            var ticket = await _databaseService.GetTicketByJiraKeyAsync(jiraKey);
            if (ticket == null)
                return NotFound($"Ticket with JIRA key {jiraKey} not found");

            return Ok(ticket);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving ticket {JiraKey}", jiraKey);
            return StatusCode(500, "Error retrieving ticket");
        }
    }

    [HttpPost]
    [Consumes("application/json")]
    public async Task<IActionResult> CreateTicket([FromBody] Ticket ticket)

    {
        try
        {
            // Calculate delivery points
            ticket.DeliveryPoints = _deliveryPointsService.CalculateTicketPoints(ticket.Complexity, ticket.Risk);
            
            var ticketId = await _databaseService.CreateTicketAsync(ticket);
            if (ticketId > 0)
            {
                var createdTicket = await _databaseService.GetTicketByIdAsync(ticketId);
                return CreatedAtAction(nameof(GetTicket), new { id = ticketId }, createdTicket);
            }

            return BadRequest("Failed to create ticket");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating ticket");
            return StatusCode(500, "Error creating ticket");
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateTicket(int id, [FromBody] Ticket ticket)
    {
        try
        {
            if (id != ticket.Id)
                return BadRequest("ID mismatch");

            // Recalculate delivery points if complexity or risk changed
            ticket.DeliveryPoints = _deliveryPointsService.CalculateTicketPoints(ticket.Complexity, ticket.Risk);

            var success = await _databaseService.UpdateTicketAsync(ticket);
            if (success)
                return Ok(ticket);

            return NotFound($"Ticket with ID {id} not found");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating ticket {TicketId}", id);
            return StatusCode(500, "Error updating ticket");
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteTicket(int id)
    {
        try
        {
            var success = await _databaseService.DeleteTicketAsync(id);
            if (success)
                return NoContent();

            return NotFound($"Ticket with ID {id} not found");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting ticket {TicketId}", id);
            return StatusCode(500, "Error deleting ticket");
        }
    }

    [HttpPatch("{id}/complexity")]
    public async Task<IActionResult> UpdateComplexity(int id, [FromBody] ComplexityLevel complexity)
    {
        try
        {
            var ticket = await _databaseService.GetTicketByIdAsync(id);
            if (ticket == null)
                return NotFound($"Ticket with ID {id} not found");

            ticket.Complexity = complexity;
            ticket.DeliveryPoints = _deliveryPointsService.CalculateTicketPoints(ticket.Complexity, ticket.Risk);

            var success = await _databaseService.UpdateTicketAsync(ticket);
            if (success)
                return Ok(new { 
                    TicketId = id, 
                    Complexity = complexity, 
                    DeliveryPoints = ticket.DeliveryPoints 
                });

            return BadRequest("Failed to update complexity");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating complexity for ticket {TicketId}", id);
            return StatusCode(500, "Error updating complexity");
        }
    }

    [HttpPatch("{id}/risk")]
    public async Task<IActionResult> UpdateRisk(int id, [FromBody] RiskLevel risk)
    {
        try
        {
            var ticket = await _databaseService.GetTicketByIdAsync(id);
            if (ticket == null)
                return NotFound($"Ticket with ID {id} not found");

            ticket.Risk = risk;
            ticket.DeliveryPoints = _deliveryPointsService.CalculateTicketPoints(ticket.Complexity, ticket.Risk);

            var success = await _databaseService.UpdateTicketAsync(ticket);
            if (success)
                return Ok(new { 
                    TicketId = id, 
                    Risk = risk, 
                    DeliveryPoints = ticket.DeliveryPoints 
                });

            return BadRequest("Failed to update risk");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating risk for ticket {TicketId}", id);
            return StatusCode(500, "Error updating risk");
        }
    }

    [HttpGet("unmapped")]
    public async Task<IActionResult> GetUnmappedTickets()
    {
        try
        {
            var tickets = await _databaseService.GetUnmappedTicketsAsync();
            return Ok(tickets);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving unmapped tickets");
            return StatusCode(500, "Error retrieving unmapped tickets");
        }
    }

    [HttpPatch("{id}/map")]
    [Consumes("application/json")]
    public async Task<IActionResult> UpdateTicketMapping(int id, [FromBody] int? projectId)

    {
        try
        {
            var success = await _databaseService.UpdateTicketProjectAsync(id, projectId == 0 ? null : projectId);
            if (success)
                return Ok(new { Message = "Ticket mapping updated" });

            return NotFound($"Ticket with ID {id} not found");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error mapping ticket {TicketId} to project {ProjectId}", id, projectId);
            return StatusCode(500, "Error updating ticket mapping");
        }
    }
}

public class TicketMovementJustificationRequest
{
    [Newtonsoft.Json.JsonProperty("justification")]
    [System.Text.Json.Serialization.JsonPropertyName("justification")]
    public string Justification { get; set; } = string.Empty;

    [Newtonsoft.Json.JsonProperty("justifiedBy")]
    [System.Text.Json.Serialization.JsonPropertyName("justifiedBy")]
    public string? JustifiedBy { get; set; }
}