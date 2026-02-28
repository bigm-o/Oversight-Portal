using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using TicketTracker.Api.Models.Entities;
using TicketTracker.Api.Models.Enums;
using TicketTracker.Api.Services.Interfaces;

namespace TicketTracker.Api.Services.Implementation;

public class JiraService : IJiraService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<JiraService> _logger;
    private readonly string _baseUrl;
    private readonly string _authHeader;
    private readonly string _email;

    private static readonly JsonSerializerOptions _jsonOptions = new JsonSerializerOptions 
    { 
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public JiraService(HttpClient httpClient, IConfiguration configuration, ILogger<JiraService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        
        var domain = configuration["JIRA_BASE_URL"] ?? throw new Exception("JIRA_BASE_URL not configured");
        var token = configuration["JIRA_API_TOKEN"] ?? throw new Exception("JIRA_API_TOKEN not configured");
        _email = configuration["JIRA_EMAIL"] ?? configuration["JIRA_USER_EMAIL"] ?? "";
        
        _baseUrl = $"{domain}/rest/api/3";
        _logger.LogInformation("JiraService [REBUILT-V2] initialized for {Domain}", domain);
        
        if (!string.IsNullOrEmpty(_email))
        {
            var authBytes = Encoding.ASCII.GetBytes($"{_email}:{token}");
            _authHeader = $"Basic {Convert.ToBase64String(authBytes)}";
        }
        else
        {
            _authHeader = $"Bearer {token}"; 
        }
    }

    public async Task<bool> AuthenticateAsync()
    {
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, $"{_baseUrl}/myself");
            request.Headers.Add("Authorization", _authHeader);
            var response = await _httpClient.SendAsync(request);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "JIRA authentication failed");
            return false;
        }
    }

    private async Task<JiraSearchResponse> ExecuteSearchAsync(string jql, string? nextPageToken, int maxResults, string[] fields)
    {
        // IMPORTANT: /search/jql is the NEW endpoint. It DOES NOT support 'startAt'.
        // It uses 'nextPageToken' for pagination.
        var request = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/search/jql");
        request.Headers.Add("Authorization", _authHeader);
        request.Headers.Add("Accept", "application/json");

        var searchBody = new 
        { 
            jql, 
            nextPageToken, // Token-based pagination
            maxResults, 
            fields 
        };
        
        var json = JsonSerializer.Serialize(searchBody, _jsonOptions);
        request.Content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await _httpClient.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            _logger.LogError("JIRA API Search Failed: {Status} - {Error}", response.StatusCode, error);
            throw new Exception($"JIRA API Search Error: {response.StatusCode} - {error}");
        }

        var content = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<JiraSearchResponse>(content, _jsonOptions) ?? new JiraSearchResponse();
    }

    public async Task<List<Ticket>> GetTicketsAsync(string projectKey)
    {
        var allTickets = new List<Ticket>();
        string? nextPageToken = null;
        int maxResults = 50;
        var fields = new[] { "summary", "status", "assignee", "created", "updated", "parent", "duedate", "description" };

        try
        {
            while (true)
            {
                var jql = string.IsNullOrEmpty(projectKey)
                    ? "issuetype != 'Epic' AND (updated >= -365d OR created >= -365d) ORDER BY updated DESC"
                    : $"project = '{projectKey}' AND issuetype != 'Epic' AND (updated >= -365d OR created >= -365d) ORDER BY updated DESC";
                
                var result = await ExecuteSearchAsync(jql, nextPageToken, maxResults, fields);
                
                if (result.Issues != null && result.Issues.Any())
                {
                    allTickets.AddRange(result.Issues.Select(MapJiraIssueToTicket));
                    _logger.LogInformation("Fetched {Count} tickets for {Project}. Total: {Total}", result.Issues.Count, projectKey, allTickets.Count);
                }

                if (string.IsNullOrEmpty(result.NextPageToken)) break;
                nextPageToken = result.NextPageToken;
            }
            return allTickets;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed fetching tickets for {Project}", projectKey);
            throw;
        }
    }

    public async Task<List<Project>> GetEpicsAsync(string projectKey)
    {
        var allEpics = new List<Project>();
        string? nextPageToken = null;
        int maxResults = 50;
        var fields = new[] { "summary", "status", "assignee", "created", "updated", "duedate", "description" };

        try
        {
            while (true)
            {
                var jql = $"project = '{projectKey}' AND issuetype = 'Epic' AND (updated >= -365d OR created >= -365d) ORDER BY updated DESC";
                var result = await ExecuteSearchAsync(jql, nextPageToken, maxResults, fields);
                
                if (result.Issues != null && result.Issues.Any())
                {
                    allEpics.AddRange(result.Issues.Select(MapJiraIssueToProject));
                }

                if (string.IsNullOrEmpty(result.NextPageToken)) break;
                nextPageToken = result.NextPageToken;
            }
            return allEpics;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed fetching epics for {Project}", projectKey);
            throw;
        }
    }

    public async Task<List<JiraProject>> GetProjectsAsync()
    {
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, $"{_baseUrl}/project");
            request.Headers.Add("Authorization", _authHeader);
            var response = await _httpClient.SendAsync(request);
            
            if (!response.IsSuccessStatusCode) return new List<JiraProject>();

            var content = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<List<JiraProject>>(content, _jsonOptions) ?? new List<JiraProject>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get projects");
            return new List<JiraProject>();
        }
    }

    public async Task<Ticket?> GetTicketAsync(string jiraKey)
    {
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, $"{_baseUrl}/issue/{jiraKey}");
            request.Headers.Add("Authorization", _authHeader);
            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode) return null;

            var content = await response.Content.ReadAsStringAsync();
            var issue = JsonSerializer.Deserialize<JiraIssue>(content, _jsonOptions);
            return issue != null ? MapJiraIssueToTicket(issue) : null;
        }
        catch { return null; }
    }

    public async Task<Project?> GetEpicFromIssueAsync(string issueKey)
    {
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, $"{_baseUrl}/issue/{issueKey}");
            request.Headers.Add("Authorization", _authHeader);
            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode) return null;

            var content = await response.Content.ReadAsStringAsync();
            var issue = JsonSerializer.Deserialize<JiraIssue>(content, _jsonOptions);
            return issue != null ? MapJiraIssueToProject(issue) : null;
        }
        catch { return null; }
    }

    public async Task<List<SprintBoardTicket>> GetActiveSprintTicketsAsync(string projectKey, int teamId)
    {
        var result = new List<SprintBoardTicket>();
        try
        {
            string domain = _baseUrl.Replace("/rest/api/3", "");

            // --- Hardcoded verified board IDs (confirmed via /rest/agile/1.0/board discovery) ---
            // These are the EXACT live scrum boards as seen on Jira:
            //   Collections → Board 91  "Collections Scrum"        (SKP, scrum)
            //   Data&Identity → Board 57  "IR board"               (IR,  scrum)
            //   Core Switching → Board 88  "Core Switching Scrum Board" (CASP, scrum)
            //   Enterprise Solution → Board 108 "Enterprise Solution board" (BARP3, scrum)
            int boardId = projectKey.ToUpper() switch
            {
                "SKP"   => 91,
                "IR"    => 57,
                "CASP"  => 88,
                "BARP3" => 108,
                _ => 0
            };

            if (boardId == 0)
            {
                // Unknown project — fall back to dynamic board discovery
                var boardReq = new HttpRequestMessage(HttpMethod.Get, $"{domain}/rest/agile/1.0/board?projectKeyOrId={projectKey}&maxResults=5");
                boardReq.Headers.Add("Authorization", _authHeader);
                var boardRes = await _httpClient.SendAsync(boardReq);
                if (!boardRes.IsSuccessStatusCode) return result;

                var boardContent = await boardRes.Content.ReadAsStringAsync();
                var boardData = JsonSerializer.Deserialize<JsonElement>(boardContent);
                if (!boardData.TryGetProperty("values", out var boards) || boards.GetArrayLength() == 0) return result;

                // Prefer scrum boards
                var scrumBoard = boards.EnumerateArray().FirstOrDefault(b =>
                    b.TryGetProperty("type", out var t) && t.GetString() == "scrum");
                var selectedBoard = scrumBoard.ValueKind != JsonValueKind.Undefined ? scrumBoard : boards.EnumerateArray().First();
                boardId = selectedBoard.GetProperty("id").GetInt32();
                _logger.LogInformation("Dynamic board selection for {Project}: board {Id}", projectKey, boardId);
            }
            else
            {
                _logger.LogInformation("Using hardcoded board {Id} for project {Project}", boardId, projectKey);
            }

            // --- Get Active Sprint from board ---
            var sprintReq = new HttpRequestMessage(HttpMethod.Get, $"{domain}/rest/agile/1.0/board/{boardId}/sprint?state=active&maxResults=5");
            sprintReq.Headers.Add("Authorization", _authHeader);
            var sprintRes = await _httpClient.SendAsync(sprintReq);

            if (!sprintRes.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to get active sprint for board {BoardId}, project {Project}", boardId, projectKey);
                return result;
            }

            var sprintContent = await sprintRes.Content.ReadAsStringAsync();
            var sprintData = JsonSerializer.Deserialize<JsonElement>(sprintContent);

            if (!sprintData.TryGetProperty("values", out var sprints) || sprints.GetArrayLength() == 0)
            {
                _logger.LogWarning("No active sprint found for board {BoardId}, project {Project}", boardId, projectKey);
                return result;
            }

            var activeSprint = sprints.EnumerateArray().First();
            int sprintId = activeSprint.GetProperty("id").GetInt32();
            var sprintName = activeSprint.TryGetProperty("name", out var sn) ? sn.GetString() : "Active Sprint";

            _logger.LogInformation("Fetching sprint {SprintId} '{SprintName}' for team {TeamId} ({Project}), board {BoardId}",
                sprintId, sprintName, teamId, projectKey, boardId);

            // --- Fetch ALL sprint issues (paginated) ---
            result.AddRange(await FetchBoardIssues(
                $"{domain}/rest/agile/1.0/sprint/{sprintId}/issue",
                teamId, "scrum"));

            _logger.LogInformation("Fetched {Count} sprint issues for {Project} (sprint: {Sprint})",
                result.Count, projectKey, sprintName);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get active sprint tickets for project {ProjectKey}", projectKey);
            return result;
        }
    }


    private async Task<List<SprintBoardTicket>> FetchBoardIssues(string url, int teamId, string boardType)
    {
        var result = new List<SprintBoardTicket>();
        int startAt = 0;
        int maxResults = 50;

        while (true)
        {
            var req = new HttpRequestMessage(HttpMethod.Get, $"{url}?startAt={startAt}&maxResults={maxResults}");
            req.Headers.Add("Authorization", _authHeader);
            var res = await _httpClient.SendAsync(req);
            if (!res.IsSuccessStatusCode) break;
            
            var content = await res.Content.ReadAsStringAsync();
            var issueResponse = JsonSerializer.Deserialize<JiraSearchResponse>(content, _jsonOptions);
            
            if (issueResponse?.Issues == null || !issueResponse.Issues.Any()) break;

            foreach (var issue in issueResponse.Issues)
            {
                result.Add(new SprintBoardTicket
                {
                    TeamId = teamId,
                    JiraKey = issue.Key ?? "",
                    Title = issue.Fields?.Summary ?? "No Title",
                    Status = issue.Fields?.Status?.Name ?? "Backlog",
                    AssignedTo = issue.Fields?.Assignee?.DisplayName,
                    DeliveryPoints = 0,
                    BoardType = boardType,
                    IsRollback = false,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
            }

            startAt += maxResults;
            if (issueResponse.Total == null || startAt >= issueResponse.Total) break;
        }

        return result;
    }


    public async Task<bool> UpdateTicketAsync(string jiraKey, Ticket ticket)
    {
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Put, $"{_baseUrl}/issue/{jiraKey}");
            request.Headers.Add("Authorization", _authHeader);
            var payload = new { fields = new { summary = ticket.Title } };
            request.Content = new StringContent(JsonSerializer.Serialize(payload, _jsonOptions), Encoding.UTF8, "application/json");
            var response = await _httpClient.SendAsync(request);
            return response.IsSuccessStatusCode;
        }
        catch { return false; }
    }

    public async Task<List<TicketMovement>> GetTicketHistoryAsync(string jiraKey)
    {
        var movements = new List<TicketMovement>();
        int startAt = 0;
        int maxResults = 100;

        try
        {
            while (true)
            {
                // NOTE: Individual issue endpoints like changelog still use startAt for now
                var url = $"{_baseUrl}/issue/{jiraKey}/changelog?startAt={startAt}&maxResults={maxResults}";
                var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.Add("Authorization", _authHeader);

                var response = await _httpClient.SendAsync(request);
                if (!response.IsSuccessStatusCode) break;

                var content = await response.Content.ReadAsStringAsync();
                var changelog = JsonSerializer.Deserialize<JiraChangelogResponse>(content, _jsonOptions);
                
                if (changelog?.Values == null || !changelog.Values.Any()) break;

                foreach (var history in changelog.Values)
                {
                    var statusItem = history.Items?.FirstOrDefault(i => i.Field == "status");
                    if (statusItem != null)
                    {
                        var date = DateTime.TryParse(history.Created, out var d) ? d : DateTime.UtcNow;
                        if (date < DateTime.UtcNow.AddYears(-1)) continue;

                        var fromStatusEnum = MapStatus(statusItem.FromString);
                        var toStatusEnum = MapStatus(statusItem.ToStatus);

                        movements.Add(new TicketMovement
                        {
                            JiraKey = jiraKey,
                            FromStatus = statusItem.FromString ?? "Unknown",
                            ToStatus = statusItem.ToStatus ?? "Unknown",
                            ChangedBy = history.Author?.DisplayName ?? "System",
                            CreatedAt = date,
                            IsRollback = (int)toStatusEnum < (int)fromStatusEnum && fromStatusEnum != TicketStatus.TODO
                        });
                    }
                }

                if (startAt + changelog.Values.Count >= (changelog.Total ?? 0)) break;
                startAt += maxResults;
            }
            return movements.OrderByDescending(m => m.CreatedAt).ToList();
        }
        catch { return movements; }
    }

    public Task StartWebhookListenerAsync() => Task.CompletedTask;

    private string ParseAdfDescription(JsonElement? description)
    {
        if (description == null || description.Value.ValueKind != JsonValueKind.Object) return "";
        var sb = new StringBuilder();
        try
        {
            if (description.Value.TryGetProperty("content", out var rootContent))
            {
                foreach (var node in rootContent.EnumerateArray())
                {
                    ExtractAdfText(node, sb);
                    sb.AppendLine();
                }
            }
        }
        catch { }
        return sb.ToString().Trim();
    }

    private void ExtractAdfText(JsonElement node, StringBuilder sb)
    {
        if (node.TryGetProperty("type", out var type) && type.GetString() == "text")
        {
            if (node.TryGetProperty("text", out var text)) sb.Append(text.GetString());
        }
        if (node.TryGetProperty("content", out var content))
        {
            foreach (var child in content.EnumerateArray()) ExtractAdfText(child, sb);
        }
    }

    private Ticket MapJiraIssueToTicket(JiraIssue issue) => new Ticket
    {
        JiraKey = issue.Key ?? "",
        Title = issue.Fields?.Summary ?? "No Title",
        Description = ParseAdfDescription(issue.Fields?.Description),
        Status = MapStatus(issue.Fields?.Status?.Name),
        AssignedTo = issue.Fields?.Assignee?.DisplayName ?? "Unassigned",
        CreatedAt = DateTime.TryParse(issue.Fields?.Created, out var c) ? c : DateTime.UtcNow,
        JiraUpdatedAt = DateTime.TryParse(issue.Fields?.Updated, out var u) ? u : null,
        EpicKey = issue.Fields?.Parent?.Key
    };

    private Project MapJiraIssueToProject(JiraIssue issue) => new Project
    {
        JiraKey = issue.Key ?? "",
        Name = issue.Fields?.Summary ?? "No Name",
        Description = ParseAdfDescription(issue.Fields?.Description),
        Lead = issue.Fields?.Assignee?.DisplayName ?? "Unassigned",
        Status = issue.Fields?.Status?.Name ?? "Active",
        StartDate = DateTime.TryParse(issue.Fields?.Created, out var c) ? c : DateTime.UtcNow,
        TargetDate = DateTime.TryParse(issue.Fields?.Duedate, out var d) ? d : null
    };

    private TicketStatus MapStatus(string? name)
    {
        if (string.IsNullOrEmpty(name)) return TicketStatus.TODO;
        
        var normalized = name.ToLower().Trim();

        if (normalized == "live" || normalized == "done" || normalized == "completed" || normalized == "closed")
            return TicketStatus.LIVE;

        if (normalized.Contains("production ready") || normalized.Contains("ready for deployment"))
            return TicketStatus.PRODUCTION_READY;

        if (normalized.Contains("cab ready") || normalized.Contains("cab") || normalized.Contains("certification"))
            return TicketStatus.CAB_READY;

        if (normalized == "uat" || normalized.Contains("user acceptance"))
            return TicketStatus.UAT;

        if (normalized.Contains("security testing") || normalized.Contains("security"))
            return TicketStatus.SECURITY_TESTING;

        if (normalized == "qa test" || normalized.Contains("qa") || normalized.Contains("quality"))
            return TicketStatus.QA_TEST;

        if (normalized.Contains("ready to test") || normalized.Contains("ready for test"))
            return TicketStatus.READY_TO_TEST;

        if (normalized == "devops")
            return TicketStatus.DEVOPS;

        if (normalized.Contains("review"))
            return TicketStatus.REVIEW;

        if (normalized == "blocked" || normalized.Contains("impediment"))
            return TicketStatus.BLOCKED;

        if (normalized == "in progress" || normalized.Contains("progress") || normalized.Contains("doing"))
            return TicketStatus.IN_PROGRESS;

        // Default or "to do", "open", "backlog"
        return TicketStatus.TODO;
    }

    // --- Internal Models ---
    private class JiraSearchResponse { public List<JiraIssue>? Issues { get; set; } public int? Total { get; set; } public string? NextPageToken { get; set; } }
    private class JiraChangelogResponse { public List<JiraHistory>? Values { get; set; } public int? Total { get; set; } }
    private class JiraIssue { public string? Key { get; set; } public JiraFields? Fields { get; set; } }
    private class JiraFields 
    { 
        public string? Summary { get; set; } 
        public JiraStatus? Status { get; set; } 
        public JiraUser? Assignee { get; set; } 
        public string? Created { get; set; } 
        public string? Updated { get; set; } 
        public JiraParent? Parent { get; set; }
        public string? Duedate { get; set; }
        public JsonElement? Description { get; set; }
    }
    private class JiraStatus { public string? Name { get; set; } }
    private class JiraUser { public string? DisplayName { get; set; } }
    private class JiraParent { public string? Key { get; set; } }
    private class JiraHistory { public string? Created { get; set; } public JiraUser? Author { get; set; } public List<JiraHistoryItem>? Items { get; set; } }
    private class JiraHistoryItem 
    { 
        public string? Field { get; set; } 
        public string? FromString { get; set; } 
        [JsonPropertyName("toString")]
        public string? ToStatus { get; set; } 
    }
}
