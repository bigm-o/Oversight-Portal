using System;

namespace TicketTracker.Api.Models.Entities
{
    public class TicketMovement
    {
        public int Id { get; set; }
        public int? TicketId { get; set; }
        public string JiraKey { get; set; } = string.Empty;
        public string FromStatus { get; set; } = string.Empty;
        public string ToStatus { get; set; } = string.Empty;
        public string ChangedBy { get; set; } = string.Empty;
        public string? Reason { get; set; }
        public string? Justification { get; set; }
        public string? JustifiedBy { get; set; }
        public DateTime? JustifiedAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool IsRollback { get; set; }
    }
}
