using TicketTracker.Api.Models.Entities;
using TicketTracker.Api.Services.Implementation;

namespace TicketTracker.Api.Services.Interfaces;

public interface IJiraService
{
    Task<bool> AuthenticateAsync();
    Task<List<Ticket>> GetTicketsAsync(string projectKey);
    Task<List<Project>> GetEpicsAsync(string projectKey);
    Task<List<JiraProject>> GetProjectsAsync();
    Task<Ticket?> GetTicketAsync(string jiraKey);
    Task<Project?> GetEpicFromIssueAsync(string issueKey);
    Task<List<SprintBoardTicket>> GetActiveSprintTicketsAsync(string projectKey, int teamId);
    Task<bool> UpdateTicketAsync(string jiraKey, Ticket ticket);
    Task<List<TicketMovement>> GetTicketHistoryAsync(string jiraKey);
    Task StartWebhookListenerAsync();
}