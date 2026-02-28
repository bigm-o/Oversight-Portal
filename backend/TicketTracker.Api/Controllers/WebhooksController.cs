using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using TicketTracker.Api.Hubs;
using TicketTracker.Api.Services.Interfaces;

namespace TicketTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class WebhooksController : ControllerBase
{
    private readonly ILogger<WebhooksController> _logger;
    private readonly IHubContext<TicketTrackerHub> _hubContext;
    private readonly IDatabaseService _databaseService;

    public WebhooksController(
        ILogger<WebhooksController> logger,
        IHubContext<TicketTrackerHub> hubContext,
        IDatabaseService databaseService)
    {
        _logger = logger;
        _hubContext = hubContext;
        _databaseService = databaseService;
    }

    [HttpPost("jira")]
    public async Task<IActionResult> JiraWebhook([FromBody] object payload)
    {
        try
        {
            _logger.LogInformation("JIRA webhook received");
            
            // Mock webhook processing - in real implementation, this would process actual JIRA events
            var payloadJson = payload.ToString();
            _logger.LogDebug("JIRA webhook payload: {Payload}", payloadJson);

            // Simulate ticket update notification
            await _hubContext.Clients.All.SendAsync("TicketUpdated", new
            {
                Type = "TicketUpdate",
                Message = "Ticket updated from JIRA",
                Timestamp = DateTime.UtcNow,
                Source = "JIRA"
            });

            return Ok(new
            {
                Status = "Success",
                Message = "JIRA webhook processed",
                Timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing JIRA webhook");
            return StatusCode(500, "Error processing webhook");
        }
    }

    [HttpPost("freshdesk")]
    public async Task<IActionResult> FreshdeskWebhook([FromBody] object payload)
    {
        try
        {
            _logger.LogInformation("Freshdesk webhook received");
            
            // Mock webhook processing - in real implementation, this would process actual Freshdesk events
            var payloadJson = payload.ToString();
            _logger.LogDebug("Freshdesk webhook payload: {Payload}", payloadJson);

            // Simulate incident update notification
            await _hubContext.Clients.All.SendAsync("IncidentUpdated", new
            {
                Type = "IncidentUpdate",
                Message = "Incident updated from Freshdesk",
                Timestamp = DateTime.UtcNow,
                Source = "Freshdesk"
            });

            return Ok(new
            {
                Status = "Success",
                Message = "Freshdesk webhook processed",
                Timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing Freshdesk webhook");
            return StatusCode(500, "Error processing webhook");
        }
    }

    [HttpGet("test")]
    public async Task<IActionResult> TestNotification()
    {
        try
        {
            await _hubContext.Clients.All.SendAsync("TestNotification", new
            {
                Type = "Test",
                Message = "Test notification from webhook controller",
                Timestamp = DateTime.UtcNow
            });

            return Ok(new
            {
                Status = "Success",
                Message = "Test notification sent",
                Timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending test notification");
            return StatusCode(500, "Error sending notification");
        }
    }
}