namespace TicketTracker.Api.Services.Implementation;

// Public JIRA models
public class JiraProject 
{ 
    public string? id { get; set; } 
    public string? key { get; set; } 
    public string? name { get; set; } 
    public string? projectTypeKey { get; set; } 
    public bool simplified { get; set; } 
    public string? style { get; set; } 
    public JiraProjectCategory? projectCategory { get; set; }
}

public class JiraProjectCategory
{
    public string? id { get; set; }
    public string? name { get; set; }
    public string? description { get; set; }
}
