namespace TicketTracker.Api.Models.DTOs
{
    public class CreateIncidentRequest
    {
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Priority { get; set; } = "Medium";
        public string? Category { get; set; }
        public string? Requester { get; set; }
        public string? AssignedTo { get; set; }
        public int Complexity { get; set; } = 1;
        public int Risk { get; set; } = 1;
    }

    public class CreateServiceRequestRequest
    {
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Priority { get; set; } = "Medium";
        public string? Category { get; set; }
        public string? Requester { get; set; }
        public string? AssignedTo { get; set; }
        public int Complexity { get; set; } = 1;
        public int Risk { get; set; } = 1;
    }

    public class GovernanceCockpitResponse
    {
        public List<object> Items { get; set; } = new();
        public GovernanceMetrics Metrics { get; set; } = new();
        public List<SlaAlert> SlaAlerts { get; set; } = new();
        public DateTime? OldestTicketDate { get; set; }
        public DateTime? OldestIncidentDate { get; set; }
    }

    public class GovernanceMetrics
    {
        public int TotalItems { get; set; }
        public int OpenItems { get; set; }
        public int OpenIncidents { get; set; }
        public int PendingItems { get; set; }
        public int ResolvedItems { get; set; }
        public int CriticalItems { get; set; }
        public int SlaBreaches { get; set; }
        public int AtRiskItems { get; set; }
        public double SlaComplianceRate { get; set; }
    }

    public class SlaAlert
    {
        public int Id { get; set; }
        public string Type { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public DateTime? SlaDueDate { get; set; }
        public bool SlaBreach { get; set; }
        public int MinutesUntilBreach { get; set; }
    }
}
