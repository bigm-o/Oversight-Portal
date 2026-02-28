using System.Text;
using System.Text.Json;
using TicketTracker.Api.Models.Entities;

namespace TicketTracker.Api.Services.Implementation;

public class FreshdeskService
{
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    private readonly ILogger<FreshdeskService> _logger;
    private readonly TicketCategorizationService _categorizationService;
    private readonly string _baseUrl;
    private readonly string _authHeader;

    public FreshdeskService(IConfiguration configuration, IHttpClientFactory httpClientFactory, ILogger<FreshdeskService> logger, TicketCategorizationService categorizationService)
    {
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient("FreshworksClient");
        _logger = logger;
        _categorizationService = categorizationService;
        
        var domain = configuration["FRESHDESK_DOMAIN"];
        var apiKey = configuration["FRESHDESK_API_KEY"];
        
        _baseUrl = $"https://{domain}/api/v2";
        _authHeader = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{apiKey}:X"));
    }

    public async Task<List<ServiceRequest>> SyncCurrentYearAsync()
    {
        var allRequests = new List<ServiceRequest>();
        var currentYearStart = new DateTime(DateTime.UtcNow.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var agentCache = new Dictionary<long, string>();
        
        try
        {
            var updatedSince = currentYearStart.ToString("yyyy-MM-ddTHH:mm:ssZ");
            _logger.LogInformation("Starting Freshdesk sync for current year since {Date}", updatedSince);
            
            for (int page = 1; page <= 100; page++)
            {
                var request = new HttpRequestMessage(HttpMethod.Get, 
                    $"{_baseUrl}/tickets?per_page=100&page={page}&updated_since={updatedSince}&include=requester,stats");
                request.Headers.Add("Authorization", $"Basic {_authHeader}");

                var response = await _httpClient.SendAsync(request);
                
                if ((int)response.StatusCode == 429)
                {
                    var retryAfter = response.Headers.RetryAfter?.Delta?.TotalSeconds ?? 60;
                    _logger.LogWarning("Freshdesk rate limit hit. Retry after {Seconds}s", retryAfter);
                    await Task.Delay(TimeSpan.FromSeconds(retryAfter));
                    continue;
                }
                
                if (!response.IsSuccessStatusCode) break;
                
                var content = await response.Content.ReadAsStringAsync();
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var tickets = JsonSerializer.Deserialize<List<FreshdeskTicket>>(content, options);
                
                if (tickets == null || tickets.Count == 0) break;
                
                foreach (var ticket in tickets)
                {
                    var serviceRequest = await MapToServiceRequest(ticket, agentCache);
                    allRequests.Add(serviceRequest);
                }
                
                if (tickets.Count < 100) break;
            }
            
            _logger.LogInformation("Synced {Count} tickets from Freshdesk for the current year", allRequests.Count);
            return allRequests;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to sync Freshdesk tickets");
            return allRequests;
        }
    }

    private async Task<ServiceRequest> MapToServiceRequest(FreshdeskTicket ticket, Dictionary<long, string> agentCache)
    {
        string? assignedTo = null;
        string? requesterEmail = null;
        
        if (ticket.responder_id.HasValue)
        {
            if (agentCache.TryGetValue(ticket.responder_id.Value, out var cachedName))
            {
                assignedTo = cachedName;
            }
            else
            {
                assignedTo = await GetAgentName(ticket.responder_id.Value);
                if (assignedTo != null)
                {
                    agentCache[ticket.responder_id.Value] = assignedTo;
                }
            }
        }
        
        // Get requester email from requester object
        requesterEmail = ticket.requester?.email;
        
        var (supportLevel, team) = _categorizationService.DetermineSupportLevel("Freshdesk", null, null, null);
        
        return new ServiceRequest
        {
            FreshdeskId = ticket.id.ToString(),
            Title = ticket.subject ?? "Untitled",
            Description = ticket.description_text ?? "No description available",
            Status = ticket.status, // Pass through real Freshdesk status code (2=Open, 3=Pending, 4=Resolved, 5=Closed)
            Priority = MapPriority(ticket.priority ?? 1),
            Category = ticket.type ?? "General",
            TicketType = "Service Request",
            SupportLevel = supportLevel,
            Team = team,
            Source = "Freshdesk",
            AssignedTo = assignedTo,
            Requester = ticket.requester?.name,
            RequesterEmail = requesterEmail,
            Channel = MapSource(ticket.source),
            NativeSlaDueDate = ticket.due_by,
            Complexity = 1,
            Risk = 1,
            DeliveryPoints = 5,
            CreatedAt = ticket.created_at,
            UpdatedAt = ticket.updated_at
        };
    }

    private async Task<string?> GetAgentName(long agentId)
    {
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, $"{_baseUrl}/agents/{agentId}");
            request.Headers.Add("Authorization", $"Basic {_authHeader}");
            
            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode) return null;
            
            var content = await response.Content.ReadAsStringAsync();
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var agent = JsonSerializer.Deserialize<FreshdeskAgent>(content, options);
            
            return agent?.contact?.name;
        }
        catch
        {
            return null;
        }
    }

    private string DetermineTicketType(FreshdeskTicket ticket)
    {
        // Freshdesk doesn't distinguish between incidents and service requests
        // All Freshdesk tickets are customer support requests
        return "Service Request";
    }

    private string MapPriority(int priority)
    {
        return priority switch
        {
            1 => "Low",
            2 => "Medium",
            3 => "High",
            4 => "Critical",
            _ => "Medium"
        };
    }

    private string? MapSource(int? source)
    {
        return source switch
        {
            1 => "Email",
            2 => "Portal",
            3 => "Phone",
            7 => "Chat",
            9 => "Feedback Widget",
            10 => "Outbound Email",
            _ => "Other"
        };
    }

    private class FreshdeskAgent
    {
        public AgentContact? contact { get; set; }
    }
    
    private class AgentContact
    {
        public string? name { get; set; }
    }

    private class FreshdeskTicket
    {
        public long id { get; set; }
        public string? subject { get; set; }
        public string? description_text { get; set; }
        public int status { get; set; }
        public int? priority { get; set; }
        public string? type { get; set; }
        public long? responder_id { get; set; }
        public int? source { get; set; }
        public DateTime? due_by { get; set; }
        public FreshdeskRequester? requester { get; set; }
        public DateTime created_at { get; set; }
        public DateTime updated_at { get; set; }
    }
    
    private class FreshdeskRequester
    {
        public string? name { get; set; }
        public string? email { get; set; }
    }
}
