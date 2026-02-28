using Microsoft.AspNetCore.Mvc;
using TicketTracker.Api.Services.Interfaces;

namespace TicketTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    private readonly ILogger<HealthController> _logger;
    private readonly IDatabaseService _databaseService;

    public HealthController(ILogger<HealthController> logger, IDatabaseService databaseService)
    {
        _logger = logger;
        _databaseService = databaseService;
    }

    [HttpGet]
    public IActionResult Get()
    {
        _logger.LogInformation("Health check requested");
        
        return Ok(new
        {
            Status = "Healthy",
            Timestamp = DateTime.UtcNow,
            Version = "1.0.0",
            Environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production",
            Message = "NIBSS Ticket Tracker API is running successfully"
        });
    }

    [HttpGet("database")]
    public async Task<IActionResult> CheckDatabase()
    {
        try
        {
            _logger.LogInformation("Database health check requested");
            
            var isConnected = await _databaseService.TestConnectionAsync();
            
            if (isConnected)
            {
                return Ok(new
                {
                    Status = "Healthy",
                    Database = "Connected",
                    Timestamp = DateTime.UtcNow
                });
            }
            else
            {
                return StatusCode(500, new
                {
                    Status = "Unhealthy",
                    Database = "Connection failed",
                    Timestamp = DateTime.UtcNow
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Database health check failed");
            return StatusCode(500, new
            {
                Status = "Unhealthy",
                Error = "Database connection failed",
                Timestamp = DateTime.UtcNow
            });
        }
    }
}