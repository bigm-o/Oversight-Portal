using Microsoft.Extensions.Configuration;

namespace TicketTracker.Api.Services.Implementation;

public class TicketCategorizationService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<TicketCategorizationService> _logger;

    public TicketCategorizationService(IConfiguration configuration, ILogger<TicketCategorizationService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public (string supportLevel, string team) DetermineSupportLevel(string source, string? groupName, string? status, string? linkedTicketId)
    {
        // L1: Freshdesk (Contact Center) — always
        if (source == "Freshdesk")
        {
            return ("L1", "Contact Center");
        }

        // L4: JIRA — always
        if (source == "JIRA")
        {
            return ("L4", "Developers");
        }

        if (source == "Freshservice")
        {
            // ── PRIORITY 1: L4 Status Check (The only way to hit L4 in FS) ──
            var l4Keywords = _configuration.GetSection("TicketCategorization:L4StatusKeywords")
                .Get<string[]>() ?? new[] { "18", "Awaiting L4", "L4" };
            
            if (!string.IsNullOrEmpty(status) && l4Keywords.Any(k => status.Equals(k, StringComparison.OrdinalIgnoreCase) || status.Contains(k, StringComparison.OrdinalIgnoreCase)))
            {
                return ("L4", "Developers");
            }

            // ── PRIORITY 2: Group Mapping (Determines L1, L2, L3) ──
            if (!string.IsNullOrEmpty(groupName))
            {
                var groupMappings = _configuration.GetSection("TicketCategorization:FreshserviceGroupMappings")
                    .Get<Dictionary<string, string>>() ?? new Dictionary<string, string>();

                // Exact match (case-insensitive)
                foreach (var mapping in groupMappings)
                {
                    if (groupName.Equals(mapping.Key, StringComparison.OrdinalIgnoreCase))
                    {
                        var level = mapping.Value;
                        // Safety: Never allow L4 from group mapping alone
                        if (level == "L4") level = "L3"; 
                        return (level, GetTeamForLevel(level));
                    }
                }

                // Keyword-based fallback for technical groups (L3)
                var l3Keywords = new[] {
                    "app", "software", "dev", "database", "db", "network", "hardware",
                    "compute", "storage", "system", "sysadmin", "vpn", "infosec", "security",
                    "implementation", "certification", "technical", "engineer", "it "
                };
                if (l3Keywords.Any(k => groupName.Contains(k, StringComparison.OrdinalIgnoreCase)))
                {
                    return ("L3", "App Support");
                }

                // Keyword-based fallback for L1
                var l1Keywords = new[] { "helpdesk", "help desk", "contact center", "first line", "1st line" };
                if (l1Keywords.Any(k => groupName.Contains(k, StringComparison.OrdinalIgnoreCase)))
                {
                    return ("L1", "Contact Center");
                }
            }

            // Default fallback for Freshservice
            return ("L2", "Service Owners");
        }

        return ("L2", "Service Owners");
    }

    private static string GetTeamForLevel(string level) => level switch
    {
        "L1" => "Contact Center",
        "L3" => "App Support",
        "L4" => "Developers",
        _ => "Service Owners"  // L2 and unmatched
    };


    public string? ExtractLinkedJiraTicket(dynamic ticketData)
    {
        try
        {
            var jiraField = _configuration["TicketCategorization:JiraLinkingField"];
            if (string.IsNullOrEmpty(jiraField)) return null;

            // Try to extract from custom field
            if (ticketData?.custom_fields != null)
            {
                var customFields = ticketData.custom_fields as IDictionary<string, object>;
                if (customFields?.ContainsKey(jiraField) == true)
                {
                    var val = customFields[jiraField]?.ToString();
                    if (!string.IsNullOrEmpty(val)) return val.Trim();
                }
            }

            // Try to extract from description
            string? description = null;
            try { description = ticketData?.description?.ToString(); } catch { }
            if (string.IsNullOrEmpty(description))
            {
                try { description = ticketData?.description_text?.ToString(); } catch { }
            }

            if (!string.IsNullOrEmpty(description))
            {
                // Refined JIRA regex: Project keys are uppercase letters (2+), followed by a dash and number.
                // We also exclude common technical false positives.
                var matches = System.Text.RegularExpressions.Regex.Matches(description, @"\b([A-Z]{2,10}-\d+)\b");
                var falsePositives = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { 
                    "UTF-8", "UTF-16", "TLS-1", "TLS-12", "TLS-13", "ISO-8859", "ISO-2022",
                    "CVE-20", "CVE-2023", "CVE-2024", "CVE-2025", "RCE-1", "SSL-3", "MD5-1"
                };

                foreach (System.Text.RegularExpressions.Match match in matches)
                {
                    var key = match.Groups[1].Value;
                    var prefix = key.Split('-')[0];
                    if (!falsePositives.Contains(key) && !falsePositives.Contains(prefix))
                    {
                        return key;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to extract linked JIRA ticket");
        }

        return null;
    }
}
