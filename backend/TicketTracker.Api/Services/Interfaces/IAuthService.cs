namespace TicketTracker.Api.Services.Interfaces;

public interface IAuthService
{
    string GenerateJwtToken(Models.DTOs.User user);
    Task<Models.DTOs.User?> ValidateCredentials(string email, string password);
    Task UpdateUserTheme(string email, string theme);
    string HashPassword(string password);
    bool VerifyPassword(string password, string hash);
    Task<string> CreateInvitationAsync(string email, string role, string permissionsJson);
    Task<Models.Auth.Invitation?> GetInvitationByTokenAsync(string token);
    Task<bool> RegisterUserAsync(string token, string firstName, string lastName, string password);
}
