using TicketTracker.Api.Models.Enums;

namespace TicketTracker.Api.Models.Entities;

public class Incident
{
    public int Id { get; set; }
    public string FreshdeskId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public IncidentStatus Status { get; set; }
    public ComplexityLevel Complexity { get; set; }
    public RiskLevel Risk { get; set; }
    public int DeliveryPoints { get; set; }
    public int Priority { get; set; }
    public int TeamId { get; set; }
    public string AssignedTo { get; set; } = string.Empty;
    public DateTime? FreshdeskUpdatedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}