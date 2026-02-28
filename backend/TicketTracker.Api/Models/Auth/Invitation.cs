namespace TicketTracker.Api.Models.Auth;

public class Invitation
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public string Role { get; set; } = "User";
    public string Permissions { get; set; } = "{}";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddHours(48); // 48 hour invite validity
    public bool IsUsed { get; set; } = false;
}
