using System.Text;
using System.Text.Json;
using TicketTracker.Api.Models.Entities;
using TicketTracker.Api.Models.Enums;

namespace TicketTracker.Api.Services.Implementation;

public class FreshserviceService
{
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    private readonly ILogger<FreshserviceService> _logger;
    private readonly TicketCategorizationService _categorizationService;
    private readonly string _baseUrl;
    private readonly string _authHeader;
    private readonly Dictionary<long, string> _groupCache = new();


    public FreshserviceService(IConfiguration configuration, IHttpClientFactory httpClientFactory, ILogger<FreshserviceService> logger, TicketCategorizationService categorizationService)
    {
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient("FreshworksClient");
        _logger = logger;
        _categorizationService = categorizationService;
        
        var domain = configuration["FRESHSERVICE_DOMAIN"];
        var apiKey = configuration["FRESHSERVICE_API_KEY"];
        
        _baseUrl = $"https://{domain}/api/v2";
        _authHeader = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{apiKey}:X"));
    }

    public async Task<List<ServiceRequest>> GetServiceRequestsAsync(int page = 1, int perPage = 100)
    {
        var agentCache = new Dictionary<long, string>();
        
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, $"{_baseUrl}/tickets?per_page={perPage}&page={page}&include=requester");
            request.Headers.Add("Authorization", $"Basic {_authHeader}");


            var response = await _httpClient.SendAsync(request);
            
            if ((int)response.StatusCode == 429)
            {
                var retryAfter = response.Headers.RetryAfter?.Delta?.TotalSeconds ?? 60;
                _logger.LogWarning("Freshservice rate limit hit. Retry after {Seconds}s", retryAfter);
                throw new HttpRequestException($"Rate limit exceeded. Retry after {retryAfter} seconds.");
            }
            
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogError("Freshservice API error: {StatusCode} - {Error}", response.StatusCode, errorContent);
                throw new HttpRequestException($"Freshservice API returned {response.StatusCode}: {errorContent}");
            }

            var content = await response.Content.ReadAsStringAsync();
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var ticketsResponse = JsonSerializer.Deserialize<FreshserviceResponse>(content, options);

            var serviceRequests = new List<ServiceRequest>();
            if (ticketsResponse?.tickets != null)
            {
                foreach (var ticket in ticketsResponse.tickets)
                {
                    serviceRequests.Add(await MapToServiceRequest(ticket, agentCache));
                }
            }

            _logger.LogInformation("Retrieved {Count} service requests from Freshservice (page {Page})", serviceRequests.Count, page);
            return serviceRequests;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get service requests from Freshservice");
            throw;
        }
    }

    public async Task<List<ServiceRequest>> SyncCurrentYearAsync()
    {
        var allRequests = new List<ServiceRequest>();
        var currentYearStart = new DateTime(DateTime.UtcNow.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var agentCache = new Dictionary<long, string>();
        
        try
        {
            var updatedSince = currentYearStart.ToString("yyyy-MM-ddTHH:mm:ssZ");
            _logger.LogInformation("Starting Freshservice sync for current year since {Date}", updatedSince);
            
            for (int page = 1; page <= 100; page++)
            {
                var request = new HttpRequestMessage(HttpMethod.Get, 
                    $"{_baseUrl}/tickets?per_page=100&page={page}&updated_since={updatedSince}&include=requester");
                request.Headers.Add("Authorization", $"Basic {_authHeader}");


                var response = await _httpClient.SendAsync(request);
                
                if (!response.IsSuccessStatusCode) break;
                
                var content = await response.Content.ReadAsStringAsync();
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var ticketsResponse = JsonSerializer.Deserialize<FreshserviceResponse>(content, options);
                
                if (ticketsResponse?.tickets == null || ticketsResponse.tickets.Count == 0) break;
                
                foreach (var ticket in ticketsResponse.tickets)
                {
                    var serviceRequest = await MapToServiceRequest(ticket, agentCache);
                    allRequests.Add(serviceRequest);
                }
                
                if (ticketsResponse.tickets.Count < 100) break;
            }
            
            _logger.LogInformation("Synced {Count} service requests from Freshservice for the current year", allRequests.Count);
            return allRequests;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to sync service requests for the current year");
            return allRequests;
        }
    }

    public async Task<int> GetOpenServiceRequestsCountAsync()
    {
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, $"{_baseUrl}/tickets?per_page=1&filter=status:2 OR status:3");
            request.Headers.Add("Authorization", $"Basic {_authHeader}");

            var response = await _httpClient.SendAsync(request);
            
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Failed to get open service requests count: {StatusCode}", response.StatusCode);
                return 0;
            }

            // Parse Link header to get total pages, then calculate total count
            // For now, fetch first page and count open/pending tickets
            var content = await response.Content.ReadAsStringAsync();
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var ticketsResponse = JsonSerializer.Deserialize<FreshserviceResponse>(content, options);

            // Fetch multiple pages to get accurate count (up to 500 tickets)
            int totalOpen = 0;
            for (int page = 1; page <= 5; page++)
            {
                var pageRequest = new HttpRequestMessage(HttpMethod.Get, $"{_baseUrl}/tickets?per_page=100&page={page}");
                pageRequest.Headers.Add("Authorization", $"Basic {_authHeader}");
                var pageResponse = await _httpClient.SendAsync(pageRequest);
                
                if (!pageResponse.IsSuccessStatusCode) break;
                
                var pageContent = await pageResponse.Content.ReadAsStringAsync();
                var pageData = JsonSerializer.Deserialize<FreshserviceResponse>(pageContent, options);
                
                if (pageData?.tickets == null || pageData.tickets.Count == 0) break;
                
                totalOpen += pageData.tickets.Count(t => t.status == 2 || t.status == 3);
                
                if (pageData.tickets.Count < 100) break;
            }

            _logger.LogInformation("Total open service requests: {Count}", totalOpen);
            return totalOpen;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get open service requests count");
            return 0;
        }
    }

    private async Task<ServiceRequest> MapToServiceRequest(FreshserviceTicket ticket, Dictionary<long, string> agentCache)
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
        
        // Get Group Name for categorization (from expanded group object if available)
        string? groupName = ticket.group?.name;
        
        // Fallback to manual fetch only if group_id exists but group object is missing
        if (string.IsNullOrEmpty(groupName) && ticket.group_id.HasValue)
        {
            groupName = await GetGroupNameAsync(ticket.group_id.Value);
        }

        // Extract linked JIRA ticket if present
        var linkedTicketId = _categorizationService.ExtractLinkedJiraTicket(ticket);

        
        // Determine support level and team
        var statusText = ticket.status.ToString();
        var (supportLevel, team) = _categorizationService.DetermineSupportLevel("Freshservice", groupName, statusText, linkedTicketId);

        _logger.LogInformation("Ticket {Id} categorized as {Level} (Group: {Group}, Team: {Team})", ticket.id, supportLevel, groupName ?? "None", team);

        return new ServiceRequest
        {
            FreshdeskId = ticket.id.ToString(),
            Title = ticket.subject ?? "Untitled",
            Description = ExtractCleanDescription(ticket.description_text ?? "", fullVersion: true),
            Status = MapStatus(ticket.status),
            Priority = MapPriority(ticket.priority ?? 1),
            Category = ticket.category ?? "General",
            TicketType = ticket.type ?? "Service Request",

            SupportLevel = supportLevel,
            Team = team,
            Source = "Freshservice",
            LinkedTicketId = linkedTicketId,
            LinkedTicketSource = !string.IsNullOrEmpty(linkedTicketId) ? "JIRA" : null,
            EscalationStatus = supportLevel == "L4" ? "Awaiting L4" : null,
            AssignedTo = assignedTo,
            Requester = ticket.requester?.name,
            RequesterEmail = requesterEmail,
            Channel = MapSource(ticket.source),
            SlaDueDate = ticket.due_by,
            SlaBreach = ticket.due_by.HasValue && DateTime.UtcNow > ticket.due_by.Value,
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
            var agentResponse = JsonSerializer.Deserialize<FreshserviceAgentResponse>(content, options);
            
            return agentResponse?.agent?.first_name != null && agentResponse?.agent?.last_name != null
                ? $"{agentResponse.agent.first_name} {agentResponse.agent.last_name}"
                : agentResponse?.agent?.first_name;
        }
        catch
        {
            return null;
        }
    }

    private async Task<string?> GetGroupNameAsync(long groupId)
    {
        if (_groupCache.TryGetValue(groupId, out var cachedName)) return cachedName;

        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, $"{_baseUrl}/groups/{groupId}");
            request.Headers.Add("Authorization", $"Basic {_authHeader}");
            
            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode) return null;
            
            var content = await response.Content.ReadAsStringAsync();
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var groupResponse = JsonSerializer.Deserialize<FreshserviceGroupResponse>(content, options);
            
            var name = groupResponse?.group?.name;
            if (name != null)
            {
                _groupCache[groupId] = name;
            }
            return name;
        }
        catch
        {
            return null;
        }
    }

    public class FreshserviceGroupResponse
    {
        public FreshserviceGroup? group { get; set; }
    }

    public class FreshserviceGroup
    {
        public string? name { get; set; }
    }


    private string ExtractCleanDescription(string rawText, bool fullVersion = false)
    {
        if (string.IsNullOrWhiteSpace(rawText)) return "No description available";
        
        var lines = rawText.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None);
        var relevantLines = new List<string>();
        
        foreach (var line in lines)
        {
            var trimmed = line.Trim();
            
            if (trimmed.StartsWith("Regards,") || 
                trimmed.StartsWith("Disclaimer") ||
                trimmed.StartsWith("This e-mail") ||
                trimmed.Contains("All Rights Reserved"))
            {
                break;
            }
            
            if (!string.IsNullOrWhiteSpace(trimmed) && 
                !trimmed.StartsWith("[cid:") &&
                !trimmed.StartsWith("<") &&
                trimmed.Length > 3)
            {
                relevantLines.Add(trimmed);
            }
        }
        
        var description = string.Join(" ", relevantLines);
        
        if (!fullVersion && description.Length > 200)
        {
            description = description.Substring(0, 197) + "...";
        }
        
        return string.IsNullOrWhiteSpace(description) ? "No description available" : description;
    }

    public class FreshserviceAgentResponse
    {
        public FreshserviceAgent? agent { get; set; }
    }
    
    public class FreshserviceAgent
    {
        public string? first_name { get; set; }
        public string? last_name { get; set; }
    }

    public class FreshserviceResponse
    {
        public List<FreshserviceTicket>? tickets { get; set; }
    }

    public class FreshserviceTicket
    {
        public long id { get; set; }
        public string? subject { get; set; }
        public string? description_text { get; set; }
        public int status { get; set; }
        public int? priority { get; set; }
        public string? category { get; set; }
        public string? type { get; set; }
        public long? responder_id { get; set; }
        public long? group_id { get; set; }
        public int? source { get; set; }
        public DateTime? due_by { get; set; }
        public FreshserviceGroup? group { get; set; }
        public FreshserviceRequester? requester { get; set; }

        public Dictionary<string, object>? custom_fields { get; set; }
        public DateTime created_at { get; set; }
        public DateTime updated_at { get; set; }
    }

    
    public class FreshserviceRequester
    {
        public string? name { get; set; }
        public string? email { get; set; }
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
            4 => "Chat",
            5 => "Feedback Widget",
            6 => "Yammer",
            7 => "AWS Cloudwatch",
            8 => "Pagerduty",
            9 => "Walkup",
            10 => "Slack",
            _ => "Other"
        };
    }

    public async Task<List<ServiceRequestMovement>> GetTicketActivitiesAsync(string ticketId, int requestId, string? finalLevel = null)
    {
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, $"{_baseUrl}/tickets/{ticketId}/activities");
            request.Headers.Add("Authorization", $"Basic {_authHeader}");

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode) return new List<ServiceRequestMovement>();

            var content = await response.Content.ReadAsStringAsync();
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var activityResponse = JsonSerializer.Deserialize<FreshserviceActivityResponse>(content, options);

            var movements = new List<ServiceRequestMovement>();
            
            // Initial state
            string currentLevel = "L1";
            string currentStatus = "Open";

            if (activityResponse?.activities != null)
            {
                // Process in chronological order (API returns reverse typically)
                var sortedActivities = activityResponse.activities.OrderBy(a => a.created_at).ToList();
                var jiraField = _configuration["TicketCategorization:JiraLinkingField"] ?? "customfield_jira_ticket";
                
                foreach (var activity in sortedActivities)
                {
                    string? toLevel = null;
                    string? toStatus = null;

                    // 1. Group changes
                    if (activity.content.Contains("set Group as ", StringComparison.OrdinalIgnoreCase))
                    {
                        var groupPart = activity.content.Split("set Group as ")[1];
                        var groupName = groupPart.Split(new[] { ',', '.' }, StringSplitOptions.RemoveEmptyEntries)[0].Trim();
                        (toLevel, _) = _categorizationService.DetermineSupportLevel("Freshservice", groupName, null, null);
                    }

                    // 2. Status changes
                    if (activity.content.Contains("set Status as ", StringComparison.OrdinalIgnoreCase))
                    {
                        var statusPart = activity.content.Split("set Status as ")[1];
                        toStatus = statusPart.Split(new[] { ',', '.' }, StringSplitOptions.RemoveEmptyEntries)[0].Trim();
                        
                        // Check if status is a known L4 keyword
                        var l4Keywords = _configuration.GetSection("TicketCategorization:L4StatusKeywords").Get<string[]>() ?? Array.Empty<string>();
                        if (l4Keywords.Any(k => toStatus.Contains(k, StringComparison.OrdinalIgnoreCase)))
                        {
                            toLevel = "L4";
                        }
                    }



                    if ((toLevel != null && toLevel != currentLevel) || (toStatus != null && toStatus != currentStatus))
                    {
                        movements.Add(new ServiceRequestMovement
                        {
                            ServiceRequestId = requestId,
                            ExternalId = ticketId,
                            Source = "Freshservice",
                            FromLevel = currentLevel,
                            ToLevel = toLevel ?? currentLevel,
                            FromStatus = currentStatus,
                            ToStatus = toStatus ?? currentStatus,
                            ChangedBy = activity.actor?.name ?? "System",
                            CreatedAt = activity.created_at
                        });

                        if (toLevel != null) currentLevel = toLevel;
                        if (toStatus != null) currentStatus = toStatus;
                    }
                }
            }

            // Final safety check: if the journey doesn't end at the current level, add a final transition
            if (!string.IsNullOrEmpty(finalLevel) && currentLevel != finalLevel)
            {
                movements.Add(new ServiceRequestMovement
                {
                    ServiceRequestId = requestId,
                    ExternalId = ticketId,
                    Source = "Freshservice",
                    FromLevel = currentLevel,
                    ToLevel = finalLevel,
                    FromStatus = currentStatus,
                    ToStatus = currentStatus,
                    ChangedBy = "System",
                    CreatedAt = DateTime.UtcNow
                });
            }

            return movements;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get activities for ticket {TicketId}", ticketId);
            return new List<ServiceRequestMovement>();
        }
    }

    private class FreshserviceActivityResponse
    {
        public List<FreshserviceActivity>? activities { get; set; }
    }

    private class FreshserviceActivity
    {
        public FreshserviceActor? actor { get; set; }
        public string content { get; set; } = "";
        public List<string>? sub_contents { get; set; }
        public DateTime created_at { get; set; }
    }

    private class FreshserviceActor
    {
        public long id { get; set; }
        public string? name { get; set; }
        public bool is_agent { get; set; }
    }

    private int MapStatus(int fsStatus)
    {
        // This Freshservice account uses 0-indexed base status codes.
        // Normalize to standard codes so both Freshdesk and Freshservice align:
        //   FS-API-0 (Open)     -> 2  (Open)
        //   FS-API-1 (Pending)  -> 3  (Pending)
        //   FS-API-2 (Resolved) -> 4  (Resolved)
        //   FS-API-3 (Closed)   -> 5  (Closed)
        //   Custom codes (18=Awaiting L4, 19=Change Freeze, 6-10 etc.) pass through
        //   18 = Awaiting L4 Support   ← triggers L4 escalation
        //   19 = Awaiting Change Freeze Lift
        return fsStatus switch
        {
            0 => 2,
            1 => 3,
            2 => 4,
            3 => 5,
            _ => fsStatus
        };
    }
}
