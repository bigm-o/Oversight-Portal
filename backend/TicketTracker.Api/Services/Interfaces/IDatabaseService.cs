using TicketTracker.Api.Models.Entities;
using Auth = TicketTracker.Api.Models.Auth;

namespace TicketTracker.Api.Services.Interfaces;

public interface IDatabaseService
{
    // Ticket operations
    Task<List<Ticket>> GetTicketsAsync(DateTime? startDate = null, DateTime? endDate = null);
    Task<Ticket?> GetTicketByIdAsync(int id);
    Task<Ticket?> GetTicketByJiraKeyAsync(string jiraKey);
    Task<int> CreateTicketAsync(Ticket ticket);
    Task<bool> UpdateTicketAsync(Ticket ticket);
    Task<bool> DeleteTicketAsync(int id);
    Task<int> CreateTicketMovementAsync(TicketMovement movement);
    Task<List<TicketMovement>> GetTicketMovementsAsync(string? jiraKey = null, DateTime? startDate = null, DateTime? endDate = null);
    Task<bool> UpdateMovementJustificationAsync(int movementId, string justification, string justifiedBy);
    Task<List<Ticket>> GetUnmappedTicketsAsync();
    Task<List<SprintBoardTicket>> GetSprintBoardTicketsAsync(int teamId);
    Task ReplaceSprintBoardTicketsAsync(int teamId, List<SprintBoardTicket> tickets);
    Task<Dictionary<int, int>> GetSprintTicketCountsAsync();
    Task<bool> UpdateTicketProjectAsync(int ticketId, int? projectId);


    // Incident operations
    Task<List<Incident>> GetIncidentsAsync();
    Task<Incident?> GetIncidentByIdAsync(int id);
    Task<int> CreateIncidentAsync(Incident incident);
    Task<bool> UpdateIncidentAsync(Incident incident);

    // Project operations
    Task<int> UpsertProjectAsync(Project project);
    Task<Project?> GetProjectByJiraKeyAsync(string jiraKey);
    Task<Project?> GetProjectByIdAsync(int id);
    Task<List<Project>> GetAllProjectsAsync();
    Task<List<dynamic>> GetAllProjectsWithMetricsAsync(bool includeEmpty = false);
    Task<bool> UpdateProjectAsync(Project project);
    Task<bool> DeleteProjectAsync(int id);

    // Delivery aggregation operations
    Task<DeliveryAggregation?> GetDeliveryAggregationAsync(int projectId);
    Task<bool> UpdateDeliveryAggregationAsync(DeliveryAggregation aggregation);
    Task RecalculateProjectDeliveryPointsAsync(int projectId);

    // Governance operations
    Task<List<GovernanceApproval>> GetPendingApprovalsAsync();
    Task<int> CreateGovernanceApprovalAsync(GovernanceApproval approval);
    Task<bool> UpdateGovernanceApprovalAsync(GovernanceApproval approval);

    // Service Request operations
    Task<List<ServiceRequest>> GetServiceRequestsAsync(string? source = null, bool? escalatedOnly = null, string? team = null, string? institution = null, string? priority = null, DateTime? startDate = null, DateTime? endDate = null, string? level = null, string? fromLevel = null, string? toLevel = null);
    Task<ServiceRequest?> GetServiceRequestByExternalIdAsync(string externalId);
    Task<int> UpsertServiceRequestAsync(ServiceRequest request);
    Task<bool> CloseLinkedFreshserviceTicketsAsync(string jiraTicketId);
    Task<int> CreateServiceRequestMovementAsync(ServiceRequestMovement movement);
    Task<List<ServiceRequestMovement>> GetServiceRequestMovementsAsync(string? externalId = null);
    Task<List<DevelopmentIncident>> GetDevelopmentIncidentsAsync(DateTime? startDate = null, DateTime? endDate = null);
    Task<bool> SyncDevelopmentIncidentsAsync();
    Task<bool> UpdateDevelopmentIncidentTeamAsync(int id, string team);
    Task<bool> ReassignDevelopmentIncidentLevelAsync(int id, string level);

    Task<int> SyncEscalationsFromMovementsAsync();
    Task<int> CreateEscalationAsync(Escalation escalation);
    Task<List<Escalation>> GetEscalationRecordsAsync(string? fromLevel = null, string? toLevel = null, DateTime? startDate = null, DateTime? endDate = null);

    // Health check
    Task<bool> TestConnectionAsync();
    Task InitializeServiceRequestSchemaAsync();
    Task<List<string>> GetAllColumnsAsync(string tableName);
    Task<List<string>> GetAllTablesAsync();
    Task<int> ExecuteRawSqlAsync(string sql);
    Task<List<dynamic>> QueryRawSqlAsync(string sql, object? parameters = null);
    Task PurgeOldDataAsync();

    // Team operations
    Task<List<Team>> GetTeamsAsync();
    Task<Team?> GetTeamByIdAsync(int id);
    Task<int> CreateTeamAsync(Team team);
    Task<bool> UpdateTeamAsync(Team team);
    Task<bool> DeleteTeamAsync(int id);

    // Jira Project Mappings
    Task InitializeJiraSchemaAsync();
    Task UpsertJiraProjectSourceAsync(string key, string name, string category, int? teamId = null);
    Task<List<dynamic>> GetAllJiraProjectSourcesAsync();

    // Authentication operations
    Task InitializeAuthSchemaAsync();
    Task<int> CreateUserAsync(Auth.User user);
    Task<Auth.User?> GetUserByEmailAsync(string email);
    Task<List<Auth.User>> GetAllUsersAsync();
    Task<bool> UpdateUserAsync(int userId, string role, string permissionsJson);
    Task<bool> UpdateUserStatusAsync(int userId, bool isActive);
    Task<bool> UpdateUserThemeAsync(string email, string theme);
    Task<bool> UpdateUserPasswordAsync(string email, string passwordHash);
    Task<string> CreateInvitationAsync(Auth.Invitation invitation);
    Task<Auth.Invitation?> GetInvitationByTokenAsync(string token);
    Task<bool> MarkInvitationAsUsedAsync(int invitationId);

    // Analytics operations
    Task<TicketTracker.Api.Models.DTOs.GovernanceAnalyticsResponse> GetGovernanceAnalyticsAsync(TicketTracker.Api.Models.DTOs.AnalyticsFilter? filter = null);
}