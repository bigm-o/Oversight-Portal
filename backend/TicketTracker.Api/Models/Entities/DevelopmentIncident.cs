using System;

namespace TicketTracker.Api.Models.Entities
{
    public class DevelopmentIncident
    {
        public int Id { get; set; }
        public string? FreshdeskId { get; set; }
        public string? JiraKey { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string FreshserviceStatus { get; set; } = "Awaiting L4";
        public string? JiraStatus { get; set; }
        public string Priority { get; set; } = "Medium";
        public string? Team { get; set; }
        public string? AssignedTo { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public DateTime? ResolvedAt { get; set; }
        public bool SlaBreach { get; set; }
        public int DeliveryPoints { get; set; }
        public string Source { get; set; } = "Freshservice";
        public bool ReassignedFromL4 { get; set; } = false;
        public string? ReassignedToLevel { get; set; }
        public DateTime? ReassignedAt { get; set; }
    }
}
