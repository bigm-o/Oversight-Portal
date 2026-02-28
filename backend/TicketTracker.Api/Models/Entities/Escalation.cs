using System;

namespace TicketTracker.Api.Models.Entities
{
    public class Escalation
    {
        public int Id { get; set; }
        public int ServiceRequestId { get; set; }
        public string FreshdeskId { get; set; } = string.Empty;
        public string FromLevel { get; set; } = string.Empty;
        public string ToLevel { get; set; } = string.Empty;
        public DateTime EscalatedAt { get; set; }
        public string? EscalatedBy { get; set; }
        public string? AssignedTeam { get; set; }
        public string? Title { get; set; }
        public int? Status { get; set; }
        public string? SupportLevel { get; set; }
        public string? Description { get; set; }
        public bool SlaBreach { get; set; }
    }
}
