namespace TicketTracker.Api.Models.Auth;

public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Theme { get; set; } = "light";
    public bool IsActive { get; set; } = true;
    public string Role { get; set; } = "User";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // JSONB serialized permission structure
    // E.g., { "pages": ["dashboard", "development"], "teams": [1, 2], "admin": true }
    public string Permissions { get; set; } = "{}"; 
}
