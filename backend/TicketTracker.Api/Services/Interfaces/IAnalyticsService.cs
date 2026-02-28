using TicketTracker.Api.Models.DTOs;

namespace TicketTracker.Api.Services.Interfaces;

public interface IAnalyticsService
{
    Task<DeliveryEfficiencyTrends> GetDeliveryEfficiencyTrends(int days = 30);
    Task<List<TeamPerformance>> GetTeamPerformanceComparison();
    Task<RollbackAnalysis> GetRollbackAnalysis();
}
