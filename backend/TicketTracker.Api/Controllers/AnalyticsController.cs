using Microsoft.AspNetCore.Mvc;
using TicketTracker.Api.Services.Interfaces;

namespace TicketTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AnalyticsController : ControllerBase
{
    private readonly IAnalyticsService _analyticsService;
    private readonly ILogger<AnalyticsController> _logger;

    public AnalyticsController(IAnalyticsService analyticsService, ILogger<AnalyticsController> logger)
    {
        _analyticsService = analyticsService;
        _logger = logger;
    }

    [HttpGet("delivery-trends")]
    public async Task<IActionResult> GetDeliveryTrends([FromQuery] int days = 30)
    {
        try
        {
            var trends = await _analyticsService.GetDeliveryEfficiencyTrends(days);
            return Ok(trends);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting delivery trends");
            return StatusCode(500, "Error retrieving delivery trends");
        }
    }

    [HttpGet("team-performance")]
    public async Task<IActionResult> GetTeamPerformance()
    {
        try
        {
            var performance = await _analyticsService.GetTeamPerformanceComparison();
            return Ok(performance);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting team performance");
            return StatusCode(500, "Error retrieving team performance");
        }
    }

    [HttpGet("rollback-analysis")]
    public async Task<IActionResult> GetRollbackAnalysis()
    {
        try
        {
            var analysis = await _analyticsService.GetRollbackAnalysis();
            return Ok(analysis);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting rollback analysis");
            return StatusCode(500, "Error retrieving rollback analysis");
        }
    }
}
