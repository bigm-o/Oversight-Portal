namespace TicketTracker.Api.Services.Interfaces;

public interface IJiraSyncService
{
    Task SyncAllProjectsAsync(string jobId = null);
    Task SyncSprintBoardAsync(int teamId, string projectKey, string jobId = null);
}
