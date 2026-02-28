using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TicketTracker.Api.Services.Interfaces;
using System.Security.Claims;

namespace TicketTracker.Api.Controllers
{
    [ApiController]
    [Route("api/users")]
    [Authorize] 
    public class UsersController : ControllerBase
    {
        private readonly IDatabaseService _databaseService;
        private readonly IAuthService _authService;
        private readonly ILogger<UsersController> _logger;

        public UsersController(IDatabaseService databaseService, IAuthService authService, ILogger<UsersController> logger)
        {
            _databaseService = databaseService;
            _authService = authService;
            _logger = logger;
            _logger.LogInformation("UsersController initialized");
        }

        [HttpGet("me")]
        public async Task<IActionResult> GetMe()
        {
            try
            {
                var email = User.Claims.FirstOrDefault(c => c.Type == "email" || c.Type == ClaimTypes.Email)?.Value;
                if (string.IsNullOrEmpty(email))
                {
                    return Unauthorized();
                }

                var user = await _databaseService.GetUserByEmailAsync(email);
                if (user == null)
                {
                    return NotFound();
                }

                return Ok(new
                {
                    user.Email,
                    user.FirstName,
                    user.LastName,
                    user.Role,
                    Permissions = user.Permissions ?? "{}",
                    user.Theme,
                    user.IsActive
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching current user info");
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetAllUsers()
        {
            try
            {
                // Verify Admin role manually to be safe against claim mapping issues
                var role = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Role || c.Type == "role")?.Value;
                
                if (role != "Admin")
                {
                    _logger.LogWarning("Unauthorized access attempt to GetAllUsers. User role: {Role}", role ?? "null");
                    return Forbid();
                }

                var users = await _databaseService.GetAllUsersAsync();
                
                // Sanitize sensitive data 
                var safeUsers = users.Select(u => new 
                {
                    u.Id,
                    u.Email,
                    u.FirstName,
                    u.LastName,
                    u.Role,
                    u.Permissions,
                    u.IsActive,
                    u.CreatedAt
                });
                
                return Ok(safeUsers);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching users");
                return StatusCode(500, "Failed to fetch users");
            }
        }

        [HttpPut("{id}/permissions")]
        public async Task<IActionResult> UpdatePermissions(int id, [FromBody] UpdatePermissionsRequest request)
        {
            try
            {
                var role = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Role || c.Type == "role")?.Value;
                if (role != "Admin")
                {
                   return Forbid();
                }

                _logger.LogInformation("Received permissions update for user {UserId}. Raw request object: {@Request}", id, request);

                string permissionsJson;
                if (request.Permissions != null)
                {
                    permissionsJson = request.Permissions.ToString(Newtonsoft.Json.Formatting.None);
                }
                else 
                {
                    permissionsJson = "{}";
                }

                _logger.LogInformation("Serialized permissions JSON: {Json}", permissionsJson);

                // --- Last Admin Protection ---
                var allUsers = await _databaseService.GetAllUsersAsync();
                var activeAdmins = allUsers.Where(u => u.IsActive && u.Role == "Admin").ToList();
                
                if (activeAdmins.Any(u => u.Id == id) && activeAdmins.Count <= 1)
                {
                    // Target is the last active admin. Check if we're trying to remove admin role or deactivate.
                    bool willBeAdmin = request.Role == "Admin";
                    bool willBeActive = !request.IsActive.HasValue || request.IsActive.Value;

                    if (!willBeAdmin || !willBeActive)
                    {
                        _logger.LogWarning("Prevented revoking permissions for the last active admin (UserId: {UserId})", id);
                        return BadRequest(new { message = "You cannot revoke admin privileges or deactivate the last active administrator. Please promote another user to administrator first." });
                    }
                }
                // ------------------------------
                
                var result = await _databaseService.UpdateUserAsync(id, request.Role ?? "User", permissionsJson);
                
                if (result)
                {
                    // Also update status if provided
                    if (request.IsActive.HasValue)
                    {
                        await _databaseService.UpdateUserStatusAsync(id, request.IsActive.Value);
                    }
                    return Ok(new { message = "User updated successfully" });
                }

                
                return NotFound("User not found or update failed");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating permissions for user {UserId}", id);
                return StatusCode(500, "Failed to update permissions");
            }
        }

        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
        {
            try
            {
                var email = User.Claims.FirstOrDefault(c => c.Type == "email" || c.Type == ClaimTypes.Email)?.Value;
                if (string.IsNullOrEmpty(email))
                {
                    return Unauthorized();
                }

                var user = await _authService.ValidateCredentials(email, request.CurrentPassword);
                if (user == null)
                {
                    return BadRequest(new { message = "Invalid current password" });
                }

                var newHash = _authService.HashPassword(request.NewPassword);
                var result = await _databaseService.UpdateUserPasswordAsync(email, newHash);

                if (result)
                {
                    return Ok(new { message = "Password updated successfully" });
                }

                return StatusCode(500, "Failed to update password");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Password change error");
                return StatusCode(500, "Failed to change password");
            }
        }

        [HttpPut("theme")]
        public async Task<IActionResult> UpdateTheme([FromBody] UpdateThemeRequest request)
        {
            try
            {
                var email = User.Claims.FirstOrDefault(c => c.Type == "email" || c.Type == System.Security.Claims.ClaimTypes.Email)?.Value;
                if (string.IsNullOrEmpty(email))
                {
                    return Unauthorized();
                }

                await _databaseService.UpdateUserThemeAsync(email, request.Theme);
                
                return Ok(new { message = "Theme updated successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Theme update error");
                return StatusCode(500, "Theme update failed");
            }
        }

        private string ParseRole(string permissionsJson)
        {
            try
            {
                if (string.IsNullOrEmpty(permissionsJson)) return "User";
                using var doc = System.Text.Json.JsonDocument.Parse(permissionsJson);
                if (doc.RootElement.TryGetProperty("admin", out var adminProp) && adminProp.GetBoolean())
                {
                    return "Admin";
                }
            }
            catch {}
            return "User";
        }
    }

    public class UpdatePermissionsRequest
    {
        [Newtonsoft.Json.JsonProperty("permissions")]
        [System.Text.Json.Serialization.JsonPropertyName("permissions")]
        public Newtonsoft.Json.Linq.JObject Permissions { get; set; }

        [Newtonsoft.Json.JsonProperty("isActive")]
        [System.Text.Json.Serialization.JsonPropertyName("isActive")]
        public bool? IsActive { get; set; }

        public string Role { get; set; } = "User";
    }

    public class UpdateThemeRequest
    {
        public string Theme { get; set; } = "light";
    }

    public class ChangePasswordRequest
    {
        public string CurrentPassword { get; set; } = "";
        public string NewPassword { get; set; } = "";
    }
}

