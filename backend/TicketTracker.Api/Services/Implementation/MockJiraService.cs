using TicketTracker.Api.Models.Entities;
using TicketTracker.Api.Models.Enums;
using TicketTracker.Api.Services.Interfaces;

namespace TicketTracker.Api.Services.Implementation;

public class MockJiraService : IJiraService
{
    private readonly ILogger<MockJiraService> _logger;

    public MockJiraService(ILogger<MockJiraService> logger)
    {
        _logger = logger;
    }

    public async Task<List<Project>> GetEpicsAsync(string projectKey)
    {
        // Return dummy epics for mock mode
        return await Task.FromResult(new List<Project>
        {
            new Project { JiraKey = "MOCK-EPIC-1", Name = "Mock Project A", TeamId = 1, Status = "Active", StartDate = DateTime.Now, TargetDate = DateTime.Now.AddMonths(1) },
            new Project { JiraKey = "MOCK-EPIC-2", Name = "Mock Project B", TeamId = 2, Status = "Active", StartDate = DateTime.Now, TargetDate = DateTime.Now.AddMonths(1) }
        });
    }

    public async Task<bool> AuthenticateAsync()
    {
        _logger.LogInformation("Mock JIRA authentication - will be replaced with real OAuth when admin access is available");
        return await Task.FromResult(true);
    }

    public async Task<List<Ticket>> GetTicketsAsync(string projectKey)
    {
        _logger.LogInformation("Mock JIRA GetTickets for project {ProjectKey}", projectKey);
        
        // Return mock data for testing
        var mockTickets = new List<Ticket>
        {
            new Ticket
            {
                Id = 1,
                JiraKey = $"{projectKey}-001",
                Title = "Sample Development Task",
                Status = TicketStatus.IN_PROGRESS,
                Complexity = ComplexityLevel.C2,
                Risk = RiskLevel.R1,
                DeliveryPoints = 30, // (2+1) * 10
                ProjectId = 1,
                AssignedTo = "developer@nibss-plc.com.ng",
                CreatedAt = DateTime.UtcNow.AddDays(-5),
                UpdatedAt = DateTime.UtcNow
            }
        };

        return await Task.FromResult(mockTickets);
    }

    public async Task<Ticket?> GetTicketAsync(string jiraKey)
    {
        _logger.LogInformation("Mock JIRA GetTicket for {JiraKey}", jiraKey);
        
        var mockTicket = new Ticket
        {
            Id = 1,
            JiraKey = jiraKey,
            Title = "Mock Ticket",
            Status = TicketStatus.TODO,
            Complexity = ComplexityLevel.C1,
            Risk = RiskLevel.R1,
            DeliveryPoints = 20,
            ProjectId = 1,
            AssignedTo = "developer@nibss-plc.com.ng",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        return await Task.FromResult(mockTicket);
    }

    public async Task<Project?> GetEpicFromIssueAsync(string issueKey)
    {
        _logger.LogInformation("Mock JIRA GetEpicFromIssue for {IssueKey}", issueKey);

        var mockProject = new Project
        {
            Id = 1,
            JiraKey = issueKey,
            Name = $"Mock Epic {issueKey}",
            Status = "Active",
            TeamId = 1,
            StartDate = DateTime.UtcNow,
            TargetDate = DateTime.UtcNow.AddMonths(3)
        };

        return await Task.FromResult(mockProject);
    }

    public async Task<List<JiraProject>> GetProjectsAsync()
    {
        _logger.LogInformation("Mock JIRA GetProjects");
        
        var mockProjects = new List<JiraProject>
        {
            new JiraProject { id = "1", key = "SKP", name = "Collections" },
            new JiraProject { id = "2", key = "IR", name = "DATA & IDENTITY" },
            new JiraProject { id = "3", key = "CASP", name = "Core Switching and Processing" },
            new JiraProject { id = "4", key = "BARP3", name = "Enterprise Solutions Team" }
        };

        return await Task.FromResult(mockProjects);
    }

    public async Task<List<SprintBoardTicket>> GetActiveSprintTicketsAsync(string projectKey, int teamId)
    {
        _logger.LogInformation("Mock JIRA GetActiveSprintTickets for project {ProjectKey} and team {TeamId}", projectKey, teamId);
        
        var targetBoardName = projectKey.ToUpper() switch
        {
            "SKP" => "Collections Scrum",
            "IR" => "IR board",
            "CASP" => "Core Switching Scrum Board",
            "BARP3" => "Enterprise Solution board",
            _ => "unknown board"
        };
        
        var mockTickets = new List<SprintBoardTicket>
        {
            new SprintBoardTicket
            {
                TeamId = teamId,
                JiraKey = $"{projectKey}-999",
                Title = $"Mock Active Sprint Task ({targetBoardName})",
                Status = "In Progress",
                AssignedTo = "Mock Developer",
                DeliveryPoints = 20,
                BoardType = "scrum",
                IsRollback = false,
                CreatedAt = DateTime.UtcNow.AddDays(-2),
                UpdatedAt = DateTime.UtcNow
            }
        };
        
        return await Task.FromResult(mockTickets);
    }


    public async Task<bool> UpdateTicketAsync(string jiraKey, Ticket ticket)
    {
        _logger.LogInformation("Mock JIRA UpdateTicket for {JiraKey}", jiraKey);
        return await Task.FromResult(true);
    }

    public async Task StartWebhookListenerAsync()
    {
        _logger.LogInformation("Mock JIRA webhook listener started - will be replaced with real webhooks");
        await Task.CompletedTask;
    }

    public async Task<List<TicketMovement>> GetTicketHistoryAsync(string jiraKey)
    {
        _logger.LogInformation("Mock JIRA GetTicketHistory for {JiraKey}", jiraKey);
        
        // Return a mock historical shift
        return await Task.FromResult(new List<TicketMovement>
        {
            new TicketMovement 
            { 
                JiraKey = jiraKey, 
                FromStatus = "Backlog", 
                ToStatus = "Selected for Dev", 
                CreatedAt = DateTime.UtcNow.AddDays(-2),
                ChangedBy = "Mock User",
                IsRollback = false
            }
        });
    }
}