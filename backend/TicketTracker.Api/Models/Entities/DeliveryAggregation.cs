using TicketTracker.Api.Models.Enums;

namespace TicketTracker.Api.Models.Entities;

public class DeliveryAggregation
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public int TotalDeliveryPoints { get; set; }
    public int CompletedDeliveryPoints { get; set; }
    public decimal EfficiencyPercentage { get; set; }
    public DateTime LastCalculated { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}