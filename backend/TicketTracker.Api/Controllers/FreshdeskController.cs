using Microsoft.AspNetCore.Mvc;
using TicketTracker.Api.Services.Implementation;

namespace TicketTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FreshdeskController : ControllerBase
{
    private readonly FreshdeskService _freshdeskService;
    private readonly FreshserviceService _freshserviceService;
    private readonly ILogger<FreshdeskController> _logger;
    public FreshdeskController(
        FreshdeskService freshdeskService,
        FreshserviceService freshserviceService,
        ILogger<FreshdeskController> logger)
    {
        _freshdeskService = freshdeskService;
        _freshserviceService = freshserviceService;
        _logger = logger;
    }

    // Existing methods below
    [HttpGet("incidents")]
    public async Task<IActionResult> GetIncidents()
    {
        try
        {
            var incidents = await _freshdeskService.SyncCurrentYearAsync();
            return Ok(new { count = incidents.Count, incidents });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get incidents");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("service-requests")]
    public async Task<IActionResult> GetServiceRequests()
    {
        try
        {
            var serviceRequests = await _freshserviceService.GetServiceRequestsAsync();
            return Ok(new { count = serviceRequests.Count, serviceRequests });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get service requests");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("status")]
    public async Task<IActionResult> GetStatus()
    {
        var freshdeskConnected = false;
        var freshserviceConnected = false;
        string? freshdeskError = null;
        string? freshserviceError = null;

        try
        {
            var incidents = await _freshdeskService.SyncCurrentYearAsync();
            freshdeskConnected = true;
        }
        catch (Exception ex)
        {
            freshdeskError = ex.Message;
        }

        try
        {
            var serviceRequests = await _freshserviceService.GetServiceRequestsAsync();
            freshserviceConnected = true;
        }
        catch (Exception ex)
        {
            freshserviceError = ex.Message;
        }

        return Ok(new
        {
            freshdesk = new { connected = freshdeskConnected, domain = "nibss.freshdesk.com", error = freshdeskError },
            freshservice = new { connected = freshserviceConnected, domain = "nibss.freshservice.com", error = freshserviceError },
            timestamp = DateTime.UtcNow
        });
    }
}
