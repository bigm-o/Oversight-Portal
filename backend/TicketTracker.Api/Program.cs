using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using System.Text;
using TicketTracker.Api.Services.Interfaces;
using TicketTracker.Api.Services.Implementation;
using TicketTracker.Api.Services;
using TicketTracker.Api.Hubs;
using DotNetEnv;

// Load .env file
Env.Load();

var builder = WebApplication.CreateBuilder(args);

// Configure Kestrel to use port from configuration or default
// builder.WebHost.UseUrls("http://localhost:5001");

// Add environment variables to configuration
builder.Configuration.AddEnvironmentVariables();

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("logs/nibss-tracker-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();

// Add services to the container
builder.Services.AddControllers()
    .AddNewtonsoftJson(options =>
    {
        options.SerializerSettings.ContractResolver = new Newtonsoft.Json.Serialization.CamelCasePropertyNamesContractResolver();
        options.SerializerSettings.Converters.Add(new Newtonsoft.Json.Converters.StringEnumConverter());
    })
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });


// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { 
        Title = "NIBSS Ticket Tracker API", 
        Version = "v1",
        Description = "Analytics, Governance & Audit Layer for JIRA and Freshdesk Integration"
    });
    
    // Add JWT authentication to Swagger
    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Example: \"Authorization: Bearer {token}\"",
        Name = "Authorization",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    
    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement()
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                },
                Scheme = "oauth2",
                Name = "Bearer",
                In = Microsoft.OpenApi.Models.ParameterLocation.Header,
            },
            new List<string>()
        }
    });
});

// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:3000", "http://localhost:3001", "http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Configure JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"] ?? "your-super-secret-jwt-key-that-is-at-least-32-characters-long";
var key = Encoding.ASCII.GetBytes(jwtKey);

builder.Services.AddAuthentication(x =>
{
    x.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    x.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(x =>
{
    x.RequireHttpsMetadata = false;
    x.SaveToken = true;
    x.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = false,
        ValidateAudience = false
    };
});

// Add SignalR
builder.Services.AddSignalR();

// Add Memory Cache
builder.Services.AddMemoryCache();

// Add HTTP Client for external API calls
builder.Services.AddHttpClient();

// Configure named HttpClient for Freshworks APIs
builder.Services.AddHttpClient("FreshworksClient", client =>
{
    client.DefaultRequestHeaders.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json"));
});

// Add custom services
builder.Services.AddScoped<IDeliveryPointsService, DeliveryPointsService>();

// Use real JIRA service if enabled, otherwise use mock
var jiraEnabled = builder.Configuration["JIRA_ENABLED"] == "true" || builder.Configuration["ExternalSystems:Jira:Enabled"] == "true";
if (jiraEnabled)
{
    builder.Services.AddHttpClient<IJiraService, JiraService>(client => 
    {
        client.Timeout = TimeSpan.FromMinutes(5);
    });
    Log.Information("JIRA integration enabled with Typed HttpClient");
}
else
{
    builder.Services.AddScoped<IJiraService, MockJiraService>();
    Log.Information("Using mock JIRA service");
}


builder.Services.AddSingleton<ISyncStatusService, SyncStatusService>();
builder.Services.AddScoped<IDatabaseService, DatabaseService>();

builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IAnalyticsService, AnalyticsService>();
builder.Services.AddScoped<TicketCategorizationService>();
builder.Services.AddScoped<FreshdeskService>();
builder.Services.AddScoped<FreshserviceService>();
builder.Services.AddScoped<IJiraSyncService, JiraSyncService>();
builder.Services.AddScoped<IGptService, GptService>();
builder.Services.AddScoped<IRagService, RagService>();
builder.Services.AddHostedService<BackgroundSyncService>();
// builder.Services.AddHostedService<JiraInitialSyncService>();
// builder.Services.AddHostedService<FreshdeskInitialSyncService>();

var app = builder.Build();

// Configure the HTTP request pipeline
// Enable Swagger in all environments for development
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "NIBSS Ticket Tracker API v1");
    c.RoutePrefix = string.Empty; // Set Swagger UI at the app's root
});

app.UseHttpsRedirection();

app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// TODO: Add SignalR Hub mapping (will be added in Phase 5)
app.MapHub<TicketTrackerHub>("/ticketHub");

try
{
    Log.Information("Starting NIBSS Ticket Tracker API");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}