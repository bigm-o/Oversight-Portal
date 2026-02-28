using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TicketTracker.Api.Services.Interfaces;

namespace TicketTracker.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class DatabaseController : ControllerBase
{
    private readonly IDatabaseService _databaseService;
    private readonly ILogger<DatabaseController> _logger;

    public DatabaseController(IDatabaseService databaseService, ILogger<DatabaseController> logger)
    {
        _databaseService = databaseService;
        _logger = logger;
    }

    [HttpGet("tables")]
    public async Task<IActionResult> GetTables()
    {
        try
        {
            var tables = await _databaseService.GetAllTablesAsync();
            return Ok(tables);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching tables");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpGet("columns/{tableName}")]
    public async Task<IActionResult> GetColumns(string tableName)
    {
        try
        {
            var columns = await _databaseService.GetAllColumnsAsync(tableName);
            return Ok(columns);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching columns for table {TableName}", tableName);
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpPost("query")]
    public async Task<IActionResult> ExecuteQuery([FromBody] QueryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Sql))
        {
            return BadRequest("SQL query cannot be empty");
        }

        try
        {
            var sql = request.Sql.Trim();
            if (sql.StartsWith("SELECT", StringComparison.OrdinalIgnoreCase))
            {
                var result = await _databaseService.QueryRawSqlAsync(request.Sql);
                return Ok(result);
            }
            else
            {
                var affected = await _databaseService.ExecuteRawSqlAsync(request.Sql);
                return Ok(new { affectedRows = affected });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error executing SQL: {Sql}", request.Sql);
            return BadRequest(new { message = ex.Message });
        }
    }

    public class QueryRequest
    {
        public string Sql { get; set; } = "";
    }
}
