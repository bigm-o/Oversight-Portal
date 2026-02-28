using System;

namespace TicketTracker.Api.Models.Entities
{
    public class ServiceRequestMovement
    {
        public int Id { get; set; }
        public int? ServiceRequestId { get; set; }
        public string ExternalId { get; set; } = string.Empty;
        public string Source { get; set; } = string.Empty;
        public string? FromLevel { get; set; }
        public string? ToLevel { get; set; }
        public string? FromStatus { get; set; }
        public string? ToStatus { get; set; }
        public string? ChangedBy { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
