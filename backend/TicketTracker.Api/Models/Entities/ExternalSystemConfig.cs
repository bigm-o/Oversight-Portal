namespace TicketTracker.Api.Models.Entities;

public class ExternalSystemConfig
{
    public int Id { get; set; }
    public string SystemName { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public bool IsEnabled { get; set; }
    public DateTime LastSyncAt { get; set; }
    public string? LastSyncStatus { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}