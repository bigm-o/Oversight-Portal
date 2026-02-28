using TicketTracker.Api.Models.Enums;

namespace TicketTracker.Api.Models.Entities;

public class GovernanceApproval
{
    public int Id { get; set; }
    public ApprovalType ApprovalType { get; set; }
    public int? TicketId { get; set; }
    public int? IncidentId { get; set; }
    public string RequestedBy { get; set; } = string.Empty;
    public string? RequestReason { get; set; }
    public ApprovalStatus Status { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? RejectionReason { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}