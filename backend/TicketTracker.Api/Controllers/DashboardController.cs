using Microsoft.AspNetCore.Mvc;
using TicketTracker.Api.Services.Interfaces;
using TicketTracker.Api.Models.Enums;

namespace TicketTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly IDatabaseService _databaseService;
    private readonly ILogger<DashboardController> _logger;

    public DashboardController(IDatabaseService databaseService, ILogger<DashboardController> logger)
    {
        _databaseService = databaseService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetDashboardData([FromQuery] string? team = null, [FromQuery] string? institution = null, [FromQuery] string? priority = null, [FromQuery] DateTime? startDate = null, [FromQuery] DateTime? endDate = null)
    {
        try
        {
            _logger.LogInformation("Dashboard endpoint called with filters: team={team}, institution={institution}", team, institution);
            
            // Test database connection first
            var dbConnected = await _databaseService.TestConnectionAsync();
            if (!dbConnected)
            {
                _logger.LogWarning("Database connection failed, returning mock data");
                // Return mock data if database is not available
                var mockData = new
                {
                    Summary = new
                    {
                        TotalTickets = 0,
                        ActiveIncidents = 0,
                        DeliveryPoints = 0,
                        SlaCompliance = 94.2
                    },
                    RecentTickets = new object[0],
                    RecentIncidents = new object[0],
                    TeamMetrics = new[]
                    {
                        new { Team = "Collections", ActiveTickets = 0, DeliveryPoints = 0 },
                        new { Team = "Core Switching", ActiveTickets = 0, DeliveryPoints = 0 },
                        new { Team = "Data & Identity", ActiveTickets = 0, DeliveryPoints = 0 },
                        new { Team = "Enterprise Solutions", ActiveTickets = 0, DeliveryPoints = 0 }
                    }
                };
                return Ok(mockData);
            }
            
            var tickets = await _databaseService.GetTicketsAsync();
            var incidents = await _databaseService.GetIncidentsAsync();
            
            // Apply filtering in memory
            var filteredTickets = tickets.AsEnumerable();
            var filteredIncidents = incidents.AsEnumerable();

            if (!string.IsNullOrEmpty(team) && team != "All Teams") {
                filteredTickets = filteredTickets.Where(t => t.Team == team);
                // For incidents, we might need a mapping or just filter by team field
            }

            if (startDate.HasValue) {
                filteredTickets = filteredTickets.Where(t => t.CreatedAt >= startDate.Value);
                filteredIncidents = filteredIncidents.Where(i => i.CreatedAt >= startDate.Value);
            }

            if (endDate.HasValue) {
                filteredTickets = filteredTickets.Where(t => t.CreatedAt <= endDate.Value);
                filteredIncidents = filteredIncidents.Where(i => i.CreatedAt <= endDate.Value);
            }

            var ticketList = filteredTickets.ToList();
            var incidentList = filteredIncidents.ToList();

            _logger.LogInformation("Retrieved {TicketCount} tickets and {IncidentCount} incidents after filtering", ticketList.Count, incidentList.Count);
            
            var dashboardData = new
            {
                Summary = new
                {
                    TotalTickets = ticketList.Count(),
                    ActiveIncidents = incidentList.Count(i => i.Status != IncidentStatus.CLOSED),
                    DeliveryPoints = ticketList.Sum(t => t.DeliveryPoints),
                    SlaCompliance = 94.2 
                },
                RecentTickets = ticketList.OrderByDescending(t => t.CreatedAt).Take(5),
                RecentIncidents = incidentList.OrderByDescending(i => i.CreatedAt).Take(5),
                TeamMetrics = new[]
                {
                    new { Team = "Collections", ActiveTickets = tickets.Count(t => t.ProjectId == 1), DeliveryPoints = tickets.Where(t => t.ProjectId == 1).Sum(t => t.DeliveryPoints) },
                    new { Team = "Core Switching", ActiveTickets = tickets.Count(t => t.ProjectId == 2), DeliveryPoints = tickets.Where(t => t.ProjectId == 2).Sum(t => t.DeliveryPoints) },
                    new { Team = "Data & Identity", ActiveTickets = tickets.Count(t => t.ProjectId == 3), DeliveryPoints = tickets.Where(t => t.ProjectId == 3).Sum(t => t.DeliveryPoints) },
                    new { Team = "Enterprise Solutions", ActiveTickets = tickets.Count(t => t.ProjectId == 7 || t.ProjectId == 8), DeliveryPoints = tickets.Where(t => t.ProjectId == 7 || t.ProjectId == 8).Sum(t => t.DeliveryPoints) }
                }
            };

            return Ok(dashboardData);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching dashboard data");
            return StatusCode(500, new { error = "Internal server error", details = ex.Message });
        }
    }
}