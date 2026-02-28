namespace TicketTracker.Api.Models.Entities;

public class WebhookEvent
{
    public int Id { get; set; }
    public string Source { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    public string Payload { get; set; } = string.Empty;
    public bool Processed { get; set; }
    public DateTime ProcessedAt { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime CreatedAt { get; set; }
}