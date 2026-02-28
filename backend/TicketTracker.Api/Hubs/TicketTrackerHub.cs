using Microsoft.AspNetCore.SignalR;

namespace TicketTracker.Api.Hubs;

public class TicketTrackerHub : Hub
{
    private readonly ILogger<TicketTrackerHub> _logger;

    public TicketTrackerHub(ILogger<TicketTrackerHub> logger)
    {
        _logger = logger;
    }

    public async Task JoinProjectGroup(string projectId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"Project_{projectId}");
        _logger.LogInformation("User {ConnectionId} joined project group {ProjectId}", Context.ConnectionId, projectId);
    }

    public async Task LeaveProjectGroup(string projectId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"Project_{projectId}");
        _logger.LogInformation("User {ConnectionId} left project group {ProjectId}", Context.ConnectionId, projectId);
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("User connected: {ConnectionId}", Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("User disconnected: {ConnectionId}", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}