using System;

namespace TicketTracker.Api.Models.Entities
{
    public class SprintBoardTicket
    {
        public int Id { get; set; }
        public int TeamId { get; set; }
        public string JiraKey { get; set; } = null!;
        public string Title { get; set; } = null!;
        public string Status { get; set; } = null!;
        public string? AssignedTo { get; set; }
        public int DeliveryPoints { get; set; }
        public string BoardType { get; set; } = "unassigned";
        public bool IsRollback { get; set; } 
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
