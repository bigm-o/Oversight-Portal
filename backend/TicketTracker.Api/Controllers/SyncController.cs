using Microsoft.AspNetCore.Mvc;
using TicketTracker.Api.Services.Interfaces;

namespace TicketTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SyncController : ControllerBase
{
    private readonly ISyncStatusService _statusService;

    public SyncController(ISyncStatusService statusService)
    {
        _statusService = statusService;
    }

    [HttpGet("status/{jobId}")]
    public ActionResult GetStatus(string jobId)
    {
        if (string.IsNullOrEmpty(jobId)) return BadRequest(new { message = "jobId required" });

        var status = _statusService.GetStatus(jobId);
        if (status == null) return NotFound();

        return Ok(status);
    }
}
