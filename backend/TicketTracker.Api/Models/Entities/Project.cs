namespace TicketTracker.Api.Models.Entities;

public class Project
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int TeamId { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? TargetDate { get; set; }
    
    // New fields
    public string? JiraKey { get; set; }
    public string? Status { get; set; }
    public string? Description { get; set; }
    public string? Lead { get; set; }
    public int? PlannedPoints { get; set; }
    public int? CompletedPoints { get; set; }
}
