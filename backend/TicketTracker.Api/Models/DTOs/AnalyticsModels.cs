namespace TicketTracker.Api.Models.DTOs;

public class DeliveryEfficiencyTrends
{
    public List<DailyMetric> DailyCompletions { get; set; } = new();
}

public class DailyMetric
{
    public DateTime Date { get; set; }
    public int TicketCount { get; set; }
    public int DeliveryPoints { get; set; }
}

public class TeamPerformance
{
    public int TeamId { get; set; }
    public string TeamName { get; set; } = string.Empty;
    public int TotalProjects { get; set; }
    public int TotalTickets { get; set; }
    public int CompletedTickets { get; set; }
    public int DeliveredPoints { get; set; }
    public int RollbackCount { get; set; }
    public double CompletionRate => TotalTickets > 0 ? (double)CompletedTickets / TotalTickets * 100 : 0;
}

public class RollbackAnalysis
{
    public int TotalRollbacks { get; set; }
    public double AveragePointsLost { get; set; }
    public int AffectedProjects { get; set; }
}
