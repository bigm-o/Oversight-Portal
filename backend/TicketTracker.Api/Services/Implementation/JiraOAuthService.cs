using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

namespace TicketTracker.Api.Services.Implementation;

public class JiraOAuthService
{
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    private readonly ILogger<JiraOAuthService> _logger;
    private string? _accessToken;
    private DateTime _tokenExpiry;

    public JiraOAuthService(IConfiguration configuration, HttpClient httpClient, ILogger<JiraOAuthService> logger)
    {
        _configuration = configuration;
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<string> GetAccessTokenAsync()
    {
        // Check if using Basic Auth (API Token)
        var authType = _configuration["JIRA_AUTH_TYPE"];
        
        if (authType == "BasicAuth")
        {
            var email = _configuration["JIRA_EMAIL"];
            var apiToken = _configuration["JIRA_API_TOKEN"];
            var credentials = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{email}:{apiToken}"));
            return $"Basic {credentials}";
        }

        // OAuth flow (existing code)
        if (!string.IsNullOrEmpty(_accessToken) && DateTime.UtcNow < _tokenExpiry)
        {
            return _accessToken;
        }

        var clientId = _configuration["JIRA_OAUTH_CLIENT_ID"];
        var clientSecret = _configuration["JIRA_OAUTH_CLIENT_SECRET"];

        var requestBody = new
        {
            grant_type = "client_credentials",
            client_id = clientId,
            client_secret = clientSecret,
            audience = "api.atlassian.com"
        };

        var content = new StringContent(
            JsonSerializer.Serialize(requestBody),
            Encoding.UTF8,
            "application/json"
        );

        try
        {
            var response = await _httpClient.PostAsync("https://auth.atlassian.com/oauth/token", content);
            response.EnsureSuccessStatusCode();

            var responseBody = await response.Content.ReadAsStringAsync();
            var tokenResponse = JsonSerializer.Deserialize<TokenResponse>(responseBody);

            _accessToken = tokenResponse?.access_token;
            _tokenExpiry = DateTime.UtcNow.AddSeconds(tokenResponse?.expires_in ?? 3600);

            _logger.LogInformation("OAuth token obtained successfully");
            return $"Bearer {_accessToken}" ?? throw new Exception("Failed to get access token");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get OAuth token");
            throw;
        }
    }

    private class TokenResponse
    {
        public string? access_token { get; set; }
        public int expires_in { get; set; }
        public string? refresh_token { get; set; }
    }
}
