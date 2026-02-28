using System.Collections.Concurrent;

namespace TicketTracker.Api.Services.Interfaces;

public enum SyncStatus
{
    Running,
    Completed,
    Failed,
    Idle
}

public class SyncJobStatus
{
    public string JobId { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty; // JIRA, Freshdesk, Full
    public SyncStatus Status { get; set; }
    public string Message { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public double Progress { get; set; } // 0-100
}

public interface ISyncStatusService
{
    SyncJobStatus GetStatus(string jobId);
    SyncJobStatus GetCurrentStatus();
    void UpdateStatus(string jobId, SyncStatus status, string message = "", double progress = -1);
    string StartJob(string type);
}
