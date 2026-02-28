using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using TicketTracker.Api.Models.DTOs;
using TicketTracker.Api.Services.Interfaces;

namespace TicketTracker.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class GptController : ControllerBase
    {
        private readonly IGptService _gptService;
        private readonly IRagService _ragService;
        private readonly IDatabaseService _databaseService;
        private readonly ILogger<GptController> _logger;

        public GptController(
            IGptService gptService,
            IRagService ragService,
            IDatabaseService databaseService,
            ILogger<GptController> logger)
        {
            _gptService = gptService;
            _ragService = ragService;
            _databaseService = databaseService;
            _logger = logger;
        }

        private async Task<int> GetCurrentUserId()
        {
            var email = User.Claims.FirstOrDefault(c => c.Type == "email" || c.Type == ClaimTypes.Email)?.Value;
            if (string.IsNullOrEmpty(email)) return 0;
            var user = await _databaseService.GetUserByEmailAsync(email);
            return user?.Id ?? 0;
        }

        [HttpPost("chat")]
        public async Task<IActionResult> Chat([FromBody] GptChatRequest request)
        {
            var userId = await GetCurrentUserId();
            if (userId == 0) return Unauthorized();

            var result = await _gptService.ChatAsync(userId, request);
            return Ok(result);
        }

        [HttpPost("chat-stream")]
        public async Task ChatStream([FromBody] GptChatRequest request)
        {
            try {
                var userId = await GetCurrentUserId();
                if (userId == 0) {
                    Response.StatusCode = 401;
                    return;
                }

                Response.ContentType = "text/event-stream";
                Response.Headers.Append("Cache-Control", "no-cache");
                Response.Headers.Append("Connection", "keep-alive");

                using var writer = new System.IO.StreamWriter(Response.Body, Encoding.UTF8);

                await foreach (var chunk in _gptService.StreamChatAsync(userId, request))
                {
                    var serializedChunk = System.Text.Json.JsonSerializer.Serialize(chunk);
                    await writer.WriteAsync($"data: {serializedChunk}\n\n");
                    await writer.FlushAsync();
                }
            } catch (Exception ex) {
                _logger.LogError(ex, "Error in ChatStream endpoint");
                // If we haven't sent headers yet, we can't change status now, but usually it's better to just log
            }
        }

        [HttpGet("conversations")]
        public async Task<IActionResult> GetConversations()
        {
            var userId = await GetCurrentUserId();
            if (userId == 0) return Unauthorized();

            var results = await _gptService.GetUserConversationsAsync(userId);
            return Ok(results);
        }

        [HttpGet("conversations/{id}/history")]
        public async Task<IActionResult> GetHistory(int id)
        {
            var results = await _gptService.GetConversationHistoryAsync(id);
            return Ok(results);
        }

        [HttpDelete("conversations/{id}")]
        public async Task<IActionResult> DeleteConversation(int id)
        {
            var userId = await GetCurrentUserId();
            if (userId == 0) return Unauthorized();

            var success = await _gptService.DeleteConversationAsync(userId, id);
            return success ? Ok() : NotFound();
        }

        [HttpDelete("conversations")]
        public async Task<IActionResult> ClearAllConversations()
        {
            var userId = await GetCurrentUserId();
            if (userId == 0) return Unauthorized();

            await _gptService.DeleteAllConversationsAsync(userId);
            return Ok(new { message = "All conversations cleared" });
        }

        [HttpGet("all-ingested")]
        public async Task<IActionResult> GetAllIngested()
        {
            _logger.LogInformation("GetAllIngested endpoint hit");
            try {
                var results = await _ragService.GetDocumentsAsync();
                var list = results.ToList();
                _logger.LogInformation("Successfully found {Count} documents", list.Count);
                return Ok(list);
            } catch (Exception ex) {
                _logger.LogError(ex, "Error in GetAllIngested endpoint");
                return StatusCode(500, ex.Message);
            }
        }

        [HttpPost("documents/upload")]
        public async Task<IActionResult> UploadDocument(IFormFile file)
        {
            var userId = await GetCurrentUserId();
            if (userId == 0) return Unauthorized();

            // Minimal Auth Check: Only Admins can upload documents
            var role = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Role || c.Type == "role")?.Value;
            if (role != "Admin") return Forbid("Only administrators can upload documents for RAG.");

            if (file == null || file.Length == 0) return BadRequest("File is empty");

            using var stream = file.OpenReadStream();
            var success = await _ragService.IngestDocumentAsync(userId, file.FileName, stream);

            return success ? Ok(new { message = "Document uploaded and indexed successfully" }) 
                           : StatusCode(500, "Failed to process document");
        }

        [HttpDelete("documents/{id}")]
        public async Task<IActionResult> DeleteDocument(int id)
        {
            var role = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Role || c.Type == "role")?.Value;
            if (role != "Admin") return Forbid("Only administrators can delete documents.");

            var success = await _ragService.DeleteDocumentAsync(id);
            return success ? Ok(new { message = "Document deleted successfully" }) : NotFound();
        }
 
        [HttpGet("ping")]
        [AllowAnonymous]
        public IActionResult Ping() => Ok(new { message = "GptController is alive" });
    }
}
