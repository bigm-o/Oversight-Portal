using System;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json.Serialization;

public class UpdatePermissionsRequest
{
    [JsonProperty("permissions")]
    public JObject Permissions { get; set; }

    [JsonProperty("isActive")]
    public bool? IsActive { get; set; }
}

class Program {
    static void Main() {
        var json = "{\"permissions\": {\"pages\":[\"dashboard\"],\"teams\":[],\"admin\":false},\"isActive\": false}";
        var settings = new JsonSerializerSettings {
            ContractResolver = new CamelCasePropertyNamesContractResolver()
        };
        var request = JsonConvert.DeserializeObject<UpdatePermissionsRequest>(json, settings);
        
        Console.WriteLine($"Permissions: {request.Permissions?.ToString(Formatting.None)}");
        Console.WriteLine($"IsActive HasValue: {request.IsActive.HasValue}");
        Console.WriteLine($"IsActive Value: {request.IsActive}");
    }
}
