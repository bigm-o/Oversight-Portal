using System;
using System.Collections.Generic;

namespace TicketTracker.Api.Models.DTOs
{
    public class AnalyticsFilter
    {
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public string? Team { get; set; }
        public string? Institution { get; set; }
        public string? Priority { get; set; }
    }

    public class GovernanceAnalyticsResponse
    {
        public List<InstitutionHealth> InstitutionHealth { get; set; } = new();
        public List<TeamBreachMatrix> TeamMatrix { get; set; } = new();
        public List<BreachAgingTrend> AgingTrends { get; set; } = new();
        public List<HistoricalComplianceTrend> ComplianceTrends { get; set; } = new();
        public StabilityVsVelocity OverallStability { get; set; } = new();
    }

    public class InstitutionHealth
    {
        public string Name { get; set; } = string.Empty;
        public int Value { get; set; } // Total tickets
        public int Breached { get; set; }
        public double ComplianceRate { get; set; }
    }

    public class TeamBreachMatrix
    {
        public string Team { get; set; } = string.Empty;
        public int Critical { get; set; }
        public int High { get; set; }
        public int Medium { get; set; }
        public int Low { get; set; }
    }

    public class BreachAgingTrend
    {
        public string Bucket { get; set; } = string.Empty; // "0-4h", "4-24h", "24h+" etc.
        public int Count { get; set; }
    }

    public class HistoricalComplianceTrend
    {
        public string Date { get; set; } = string.Empty;
        public int Volume { get; set; }
        public double Compliance { get; set; }
    }

    public class StabilityVsVelocity
    {
        public List<DailyStabilityMetric> History { get; set; } = new();
    }

    public class DailyStabilityMetric
    {
        public string Date { get; set; } = string.Empty;
        public int DeliveryPoints { get; set; }
        public int Incidents { get; set; }
    }
}
