using TicketTracker.Api.Models.Enums;

namespace TicketTracker.Api.Models.Entities;

public class Ticket
{
    public int Id { get; set; }
    public string JiraKey { get; set; } = string.Empty;
    public string? EpicKey { get; set; } // Link to Project (Jira Epic)
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public TicketStatus Status { get; set; }
    public ComplexityLevel Complexity { get; set; }
    public RiskLevel Risk { get; set; }
    public int DeliveryPoints { get; set; }
    public bool CabApproved { get; set; }
    public string? CabRejectionReason { get; set; }
    public bool PointsLocked { get; set; }
    public int? ProjectId { get; set; }
    public bool IsManualProjectMap { get; set; }
    public string? Team { get; set; }
    public string AssignedTo { get; set; } = string.Empty;
    public DateTime? JiraUpdatedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}