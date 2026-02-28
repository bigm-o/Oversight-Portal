using Microsoft.AspNetCore.Mvc;
using TicketTracker.Api.Services.Interfaces;

namespace TicketTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TestAuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public TestAuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpGet("hash/{password}")]
    public IActionResult GenerateHash(string password)
    {
        var hash = _authService.HashPassword(password);
        return Ok(new { password, hash });
    }

    [HttpPost("verify")]
    public IActionResult VerifyPassword([FromBody] VerifyRequest request)
    {
        var isValid = _authService.VerifyPassword(request.Password, request.Hash);
        return Ok(new { isValid });
    }
}

public class VerifyRequest
{
    public string Password { get; set; } = string.Empty;
    public string Hash { get; set; } = string.Empty;
}
