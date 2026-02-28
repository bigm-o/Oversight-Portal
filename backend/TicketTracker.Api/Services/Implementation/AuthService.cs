using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using TicketTracker.Api.Models.DTOs;
using TicketTracker.Api.Services.Interfaces;
using Dapper;

namespace TicketTracker.Api.Services.Implementation;

public class AuthService : IAuthService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthService> _logger;
    private readonly IDatabaseService _databaseService;

    public AuthService(IConfiguration configuration, ILogger<AuthService> logger, IDatabaseService databaseService)
    {
        _configuration = configuration;
        _logger = logger;
        _databaseService = databaseService;
    }

    public string GenerateJwtToken(User user)
    {
        var jwtKey = _configuration["Jwt:Key"] ?? "your-super-secret-jwt-key-that-is-at-least-32-characters-long";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString())
        };
        
        // Add permissions as a custom claim if needed, but usually kept separate due to size
        
        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public async Task<User?> ValidateCredentials(string email, string password)
    {
        email = email.ToLowerInvariant();
        _logger.LogInformation("Attempting to validate credentials for: {Email}", email);
        var dbUser = await _databaseService.GetUserByEmailAsync(email);
        
        if (dbUser == null)
        {
            _logger.LogWarning("Login attempt with non-existent email: {Email}", email);
            return null;
        }

        if (!dbUser.IsActive)
        {
            _logger.LogWarning("Login attempt for deactivated user: {Email}", email);
            throw new Exceptions.UserDeactivatedException(email);
        }

        _logger.LogInformation("User found: {Email}, Hash present: {HashPresent}", email, !string.IsNullOrEmpty(dbUser.PasswordHash));
        
        if (!VerifyPassword(password, dbUser.PasswordHash))
        {
            _logger.LogWarning("Invalid password attempt for email: {Email}", email);
            return null;
        }
        
        _logger.LogInformation("Successful login for user: {Email}", email);

        // Map Auth.User to DTO.User
        return new User 
        {
            Id = dbUser.Id,
            Email = dbUser.Email,
            PasswordHash = dbUser.PasswordHash,
            Role = dbUser.Role,
            Theme = dbUser.Theme,
            Permissions = dbUser.Permissions,
            CreatedAt = dbUser.CreatedAt
        };
    }

    public string HashPassword(string password)
    {
        return BCrypt.Net.BCrypt.HashPassword(password);
    }

    public bool VerifyPassword(string password, string hash)
    {
        return BCrypt.Net.BCrypt.Verify(password, hash);
    }

    public async Task UpdateUserTheme(string email, string theme)
    {
        // Simple update, relying on DatabaseService would be better but keeping simple inline sql for now or adding to IDatabaseService
        // However, since we committed to IDatabaseService, let's just stick to what we have or implement UpdateUser
        // For now, retaining the old direct connection solely for this minor feature to avoid excessive changes
        using var connection = new Npgsql.NpgsqlConnection(_configuration.GetConnectionString("DefaultConnection"));
        await connection.OpenAsync();
        
        await connection.ExecuteAsync(
            "UPDATE users SET theme = @Theme WHERE LOWER(email) = LOWER(@Email)",
            new { Theme = theme, Email = email }
        );
        
        _logger.LogInformation("Theme updated to {Theme} for user: {Email}", theme, email);
    }

    public async Task<string> CreateInvitationAsync(string email, string role, string permissionsJson)
    {
        var invitation = new Models.Auth.Invitation
        {
            Email = email.ToLowerInvariant(),
            Role = role,
            Permissions = permissionsJson,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(48),
            IsUsed = false
        };
        
        return await _databaseService.CreateInvitationAsync(invitation);
    }

    public async Task<Models.Auth.Invitation?> GetInvitationByTokenAsync(string token)
    {
        return await _databaseService.GetInvitationByTokenAsync(token);
    }

    public async Task<bool> RegisterUserAsync(string token, string firstName, string lastName, string password)
    {
        var invitation = await GetInvitationByTokenAsync(token);
        if (invitation == null) return false;

        var existingUser = await _databaseService.GetUserByEmailAsync(invitation.Email);
        if (existingUser != null) return false;

        var user = new Models.Auth.User
        {
            Email = invitation.Email,
            FirstName = firstName,
            LastName = lastName,
            PasswordHash = HashPassword(password),
            Role = invitation.Role,
            Permissions = invitation.Permissions,
            CreatedAt = DateTime.UtcNow
        };

        var userId = await _databaseService.CreateUserAsync(user);
        if (userId > 0)
        {
            await _databaseService.MarkInvitationAsUsedAsync(invitation.Id);
            return true;
        }

        return false;
    }
}
