using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using TicketTracker.Api.Hubs;
using TicketTracker.Api.Services.Interfaces;

namespace TicketTracker.Api.Services.Implementation;

public class SyncStatusService : ISyncStatusService
{
    private readonly ConcurrentDictionary<string, SyncJobStatus> _jobs = new();
    private readonly IHubContext<TicketTrackerHub> _hubContext;
    private readonly ILogger<SyncStatusService> _logger;
    private string _currentJobId = string.Empty;

    public SyncStatusService(IHubContext<TicketTrackerHub> hubContext, ILogger<SyncStatusService> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public string StartJob(string type)
    {
        var jobId = Guid.NewGuid().ToString();
        var status = new SyncJobStatus
        {
            JobId = jobId,
            Type = type,
            Status = SyncStatus.Running,
            StartTime = DateTime.UtcNow,
            Message = $"Starting {type} sync...",
            Progress = 0
        };

        _jobs[jobId] = status;
        _currentJobId = jobId;

        NotifyClients(status);
        return jobId;
    }

    public void UpdateStatus(string jobId, SyncStatus status, string message = "", double progress = -1)
    {
        if (_jobs.TryGetValue(jobId, out var job))
        {
            job.Status = status;
            if (!string.IsNullOrEmpty(message)) job.Message = message;
            if (progress >= 0) job.Progress = progress;

            if (status == SyncStatus.Completed || status == SyncStatus.Failed)
            {
                job.EndTime = DateTime.UtcNow;
                job.Progress = status == SyncStatus.Completed ? 100 : job.Progress;
            }

            NotifyClients(job);
        }
    }

    public SyncJobStatus GetStatus(string jobId)
    {
        return _jobs.TryGetValue(jobId, out var status) ? status : new SyncJobStatus { Status = SyncStatus.Idle };
    }

    public SyncJobStatus GetCurrentStatus()
    {
        if (string.IsNullOrEmpty(_currentJobId)) return new SyncJobStatus { Status = SyncStatus.Idle };
        return GetStatus(_currentJobId);
    }

    private void NotifyClients(SyncJobStatus status)
    {
        _logger.LogInformation("Sync Job {JobId} ({Type}) updated: {Status} - {Message} ({Progress}%)", 
            status.JobId, status.Type, status.Status, status.Message, status.Progress);
            
        // Broadcast to all connected clients via SignalR
        _hubContext.Clients.All.SendAsync("SyncStatusUpdated", status).ConfigureAwait(false);
    }
}
