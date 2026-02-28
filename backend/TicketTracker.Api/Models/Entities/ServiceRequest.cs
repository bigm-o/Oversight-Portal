namespace TicketTracker.Api.Models.Entities
{
    public class ServiceRequest
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? FreshdeskId { get; set; }
        public int Status { get; set; }
        public string Priority { get; set; } = "Medium";
        public string? Category { get; set; }
        public string? Requester { get; set; }
        public string? RequesterEmail { get; set; }
        public string? Institution { get; set; }
        public string? AssignedTo { get; set; }
        public string? Channel { get; set; }
        public int Complexity { get; set; } = 1;
        public int Risk { get; set; } = 1;
        public int DeliveryPoints { get; set; }
        public DateTime? SlaDueDate { get; set; }
        public DateTime? NativeSlaDueDate { get; set; }
        public bool SlaBreach { get; set; }
        public string TicketType { get; set; } = "Service Request";
        public string SupportLevel { get; set; } = "L2";
        public string Source { get; set; } = "Freshservice";
        public string? Team { get; set; }
        public string? LinkedTicketId { get; set; }
        public string? LinkedTicketSource { get; set; }
        public string? EscalationStatus { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public DateTime? ResolvedAt { get; set; }
        public DateTime? FreshdeskUpdatedAt { get; set; }
    }
}
