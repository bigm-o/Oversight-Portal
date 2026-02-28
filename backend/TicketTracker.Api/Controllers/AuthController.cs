using Microsoft.AspNetCore.Mvc;
using TicketTracker.Api.Models.DTOs;
using TicketTracker.Api.Services.Interfaces;

namespace TicketTracker.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IDatabaseService _databaseService;
    private readonly ILogger<AuthController> _logger;
    private readonly IConfiguration _configuration;

    public AuthController(IAuthService authService, IDatabaseService databaseService, ILogger<AuthController> logger, IConfiguration configuration)
    {
        _authService = authService;
        _databaseService = databaseService;
        _logger = logger;
        _configuration = configuration;
    }

    [HttpPost("init-schema")]
    public async Task<IActionResult> InitializeSchema()
    {
        await _databaseService.InitializeAuthSchemaAsync();
        return Ok("Auth schema initialized");
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        // ... same logic ...
        try
        {
            var user = await _authService.ValidateCredentials(request.Email, request.Password);
            
            if (user == null)
            {
                return Unauthorized(new { message = "Invalid credentials" });
            }

            var token = _authService.GenerateJwtToken(user);

            return Ok(new LoginResponse
            {
                Token = token,
                Email = user.Email,
                Role = user.Role,
                Theme = user.Theme,
                Permissions = user.Permissions ?? "{}",
                ExpiresAt = DateTime.UtcNow.AddHours(8)
            });
        }
        catch (Exceptions.UserDeactivatedException)
        {
            return StatusCode(403, new { message = "Your account has been deactivated" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Login error");
            return StatusCode(500, "Login failed");
        }
    }

    [HttpPost("invite")]
    [Microsoft.AspNetCore.Authorization.Authorize] // Temporarily allow any authenticated user to check for 404
    public async Task<IActionResult> CreateInvitation([FromBody] InvitationRequest request)
    {
        var permissionsJson = System.Text.Json.JsonSerializer.Serialize(request.Permissions);
        var token = await _authService.CreateInvitationAsync(request.Email, request.Role, permissionsJson);
        
        if (string.IsNullOrEmpty(token))
            return StatusCode(500, "Failed to create invitation");

        var inviteLink = $"{_configuration["FrontendUrl"] ?? "http://localhost:3000"}/register?token={token}";

        return Ok(new 
        { 
            Token = token, 
            Link = inviteLink,
            Template = $"Hello,\n\nYou have been invited to join the Ticket Tracker system.\n\nPlease click the following link to set up your account:\n{inviteLink}\n\nThis link expires in 48 hours.\n\nRegards,\nAdmin Team"
        });
    }

    [HttpGet("validate-invite/{token}")]
    public async Task<IActionResult> ValidateInvite(string token)
    {
        var invitation = await _authService.GetInvitationByTokenAsync(token);
        if (invitation == null)
            return BadRequest("Invalid or expired invitation token");

        return Ok(new { invitation.Email });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var result = await _authService.RegisterUserAsync(request.Token, request.FirstName, request.LastName, request.Password);

        if (result)
            return Ok(new { message = "User registered successfully" });

        return BadRequest("Registration failed. Token may be invalid or user already exists.");
    }

    [HttpGet("validate")]
    public IActionResult ValidateToken()
    {
        return Ok(new { valid = true });
    }
}

public class InvitationRequest 
{ 
    public string Email { get; set; } = ""; 
    public string Role { get; set; } = "User";
    public object Permissions { get; set; } = new {}; 
}

public class RegisterRequest 
{ 
    public string Token { get; set; } = ""; 
    public string FirstName { get; set; } = ""; 
    public string LastName { get; set; } = ""; 
    public string Password { get; set; } = ""; 
}
