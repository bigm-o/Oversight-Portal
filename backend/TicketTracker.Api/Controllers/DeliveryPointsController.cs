using Microsoft.AspNetCore.Mvc;
using TicketTracker.Api.Models.Enums;
using TicketTracker.Api.Services.Interfaces;

namespace TicketTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DeliveryPointsController : ControllerBase
{
    private readonly IDeliveryPointsService _deliveryPointsService;
    private readonly ILogger<DeliveryPointsController> _logger;

    public DeliveryPointsController(
        IDeliveryPointsService deliveryPointsService,
        ILogger<DeliveryPointsController> logger)
    {
        _deliveryPointsService = deliveryPointsService;
        _logger = logger;
    }

    [HttpGet("calculate/ticket")]
    public IActionResult CalculateTicketPoints([FromQuery] ComplexityLevel complexity, [FromQuery] RiskLevel risk)
    {
        try
        {
            var points = _deliveryPointsService.CalculateTicketPoints(complexity, risk);
            
            return Ok(new
            {
                Type = "Ticket",
                Complexity = complexity.ToString(),
                Risk = risk.ToString(),
                DeliveryPoints = points,
                Formula = $"10 × ({(int)complexity} + {(int)risk}) = {points}",
                Timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calculating ticket points");
            return StatusCode(500, "Error calculating delivery points");
        }
    }

    [HttpGet("calculate/incident")]
    public IActionResult CalculateIncidentPoints([FromQuery] ComplexityLevel complexity, [FromQuery] RiskLevel risk)
    {
        try
        {
            var points = _deliveryPointsService.CalculateIncidentPoints(complexity, risk);
            
            return Ok(new
            {
                Type = "Incident",
                Complexity = complexity.ToString(),
                Risk = risk.ToString(),
                DeliveryPoints = points,
                Formula = $"5 × ({(int)complexity} + {(int)risk}) = {points}",
                Timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calculating incident points");
            return StatusCode(500, "Error calculating delivery points");
        }
    }

    [HttpGet("examples")]
    public IActionResult GetExamples()
    {
        var examples = new[]
        {
            new { Type = "Ticket", Complexity = "C1", Risk = "R1", Points = _deliveryPointsService.CalculateTicketPoints(ComplexityLevel.C1, RiskLevel.R1) },
            new { Type = "Ticket", Complexity = "C2", Risk = "R2", Points = _deliveryPointsService.CalculateTicketPoints(ComplexityLevel.C2, RiskLevel.R2) },
            new { Type = "Ticket", Complexity = "C4", Risk = "R4", Points = _deliveryPointsService.CalculateTicketPoints(ComplexityLevel.C4, RiskLevel.R4) },
            new { Type = "Incident", Complexity = "C1", Risk = "R1", Points = _deliveryPointsService.CalculateIncidentPoints(ComplexityLevel.C1, RiskLevel.R1) },
            new { Type = "Incident", Complexity = "C3", Risk = "R2", Points = _deliveryPointsService.CalculateIncidentPoints(ComplexityLevel.C3, RiskLevel.R2) }
        };

        return Ok(new
        {
            Message = "Delivery Points Calculation Examples",
            Formula = new
            {
                Tickets = "DP = 10 × (Complexity + Risk)",
                Incidents = "DP = 5 × (Complexity + Risk)"
            },
            Examples = examples,
            Timestamp = DateTime.UtcNow
        });
    }
}