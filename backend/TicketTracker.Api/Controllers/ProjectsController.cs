using Microsoft.AspNetCore.Mvc;
using Dapper;
using Npgsql;
using TicketTracker.Api.Services.Interfaces;
using TicketTracker.Api.Models.Entities;

namespace TicketTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProjectsController : ControllerBase
{
    private readonly IDatabaseService _databaseService;
    private readonly ILogger<ProjectsController> _logger;

    public ProjectsController(IDatabaseService databaseService, ILogger<ProjectsController> logger)
    {
        _databaseService = databaseService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetProjects([FromQuery] bool includeEmpty = false)
    {
        try
        {
            var projects = await _databaseService.GetAllProjectsWithMetricsAsync(includeEmpty);
            return Ok(projects);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving projects");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost]
    [Consumes("application/json")]
    public async Task<IActionResult> CreateProject([FromBody] TicketTracker.Api.Models.Entities.Project project)

    {
        try
        {
            if (string.IsNullOrEmpty(project.Name))
                return BadRequest("Project name is required");

            var projectId = await _databaseService.UpsertProjectAsync(project);
            if (projectId > 0)
            {
                var createdProject = await _databaseService.GetProjectByIdAsync(projectId);
                return Ok(createdProject);
            }

            return BadRequest("Failed to create project");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating project");
            return StatusCode(500, "Internal server error during project creation");
        }
    }

    [HttpPut("{id}")]
    [Consumes("application/json")]
    public async Task<IActionResult> UpdateProject(int id, [FromBody] Project project)

    {
        try
        {
            project.Id = id;
            var success = await _databaseService.UpdateProjectAsync(project);
            if (success) return Ok(new { message = "Project updated" });
            return BadRequest("Failed to update project");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating project {Id}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteProject(int id)
    {
        try
        {
            var success = await _databaseService.DeleteProjectAsync(id);
            if (success) return Ok(new { message = "Project deleted" });
            return BadRequest("Failed to delete project. Project might have mapped tickets.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting project {Id}", id);
            return StatusCode(500, "Internal server error");
        }
    }
}
