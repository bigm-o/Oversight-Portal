using TicketTracker.Api.Models.Enums;

namespace TicketTracker.Api.Services.Interfaces;

public interface IDeliveryPointsService
{
    int CalculateTicketPoints(ComplexityLevel complexity, RiskLevel risk);
    int CalculateIncidentPoints(ComplexityLevel complexity, RiskLevel risk);
    Task<bool> UpdateTicketPointsAsync(int ticketId, ComplexityLevel complexity, RiskLevel risk);
    Task<bool> UpdateIncidentPointsAsync(int incidentId, ComplexityLevel complexity, RiskLevel risk);
    Task RecalculateProjectAggregationAsync(int projectId);
}