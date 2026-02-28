using Dapper;
using Npgsql;
using TicketTracker.Api.Models.DTOs;
using TicketTracker.Api.Services.Interfaces;

namespace TicketTracker.Api.Services.Implementation;

public class AnalyticsService : IAnalyticsService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<AnalyticsService> _logger;

    public AnalyticsService(IConfiguration configuration, ILogger<AnalyticsService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<DeliveryEfficiencyTrends> GetDeliveryEfficiencyTrends(int days = 30)
    {
        using var connection = new NpgsqlConnection(_configuration.GetConnectionString("DefaultConnection"));
        
        var completedTickets = await connection.QueryAsync<dynamic>(@"
            SELECT DATE(created_at) as date, COUNT(*) as count, SUM(delivery_points) as points
            FROM tickets 
            WHERE status = 4 AND created_at >= NOW() - INTERVAL '@days days'
            GROUP BY DATE(created_at)
            ORDER BY date", new { days });

        return new DeliveryEfficiencyTrends
        {
            DailyCompletions = completedTickets.Select(t => new DailyMetric 
            { 
                Date = t.date, 
                TicketCount = t.count, 
                DeliveryPoints = t.points ?? 0 
            }).ToList()
        };
    }

    public async Task<List<TeamPerformance>> GetTeamPerformanceComparison()
    {
        using var connection = new NpgsqlConnection(_configuration.GetConnectionString("DefaultConnection"));
        
        var teams = await connection.QueryAsync<TeamPerformance>(@"
            SELECT 
                t.id as TeamId,
                t.name as TeamName,
                COUNT(DISTINCT p.id) as TotalProjects,
                COUNT(tk.id) as TotalTickets,
                COUNT(CASE WHEN tk.status = 4 THEN 1 END) as CompletedTickets,
                SUM(CASE WHEN tk.status = 4 THEN tk.delivery_points ELSE 0 END) as DeliveredPoints,
                COUNT(CASE WHEN tk.is_rollback THEN 1 END) as RollbackCount
            FROM agileteams t
            LEFT JOIN projects p ON p.team_id = t.id
            LEFT JOIN tickets tk ON tk.project_id = p.id
            GROUP BY t.id, t.name");

        return teams.ToList();
    }

    public async Task<RollbackAnalysis> GetRollbackAnalysis()
    {
        using var connection = new NpgsqlConnection(_configuration.GetConnectionString("DefaultConnection"));
        
        var rollbacks = await connection.QueryAsync<dynamic>(@"
            SELECT 
                COUNT(*) as total_rollbacks,
                AVG(delivery_points) as avg_points_lost,
                COUNT(DISTINCT project_id) as affected_projects
            FROM tickets 
            WHERE is_rollback = true");

        var rollback = rollbacks.FirstOrDefault();
        
        return new RollbackAnalysis
        {
            TotalRollbacks = rollback?.total_rollbacks ?? 0,
            AveragePointsLost = rollback?.avg_points_lost ?? 0,
            AffectedProjects = rollback?.affected_projects ?? 0
        };
    }
}
