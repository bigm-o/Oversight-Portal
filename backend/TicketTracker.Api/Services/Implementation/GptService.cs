using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using TicketTracker.Api.Models.DTOs;
using TicketTracker.Api.Models.Entities;
using TicketTracker.Api.Services.Interfaces;
using Dapper;
using Npgsql;

namespace TicketTracker.Api.Services.Implementation
{
    public class GptService : IGptService
    {
        private readonly string _connectionString;
        private readonly IConfiguration _configuration;
        private readonly ILogger<GptService> _logger;
        private readonly IDatabaseService _databaseService;
        private readonly IRagService _ragService;
        private readonly HttpClient _httpClient;

        public GptService(
            IConfiguration configuration, 
            ILogger<GptService> logger,
            IDatabaseService databaseService,
            IRagService ragService,
            IHttpClientFactory httpClientFactory)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection") 
                ?? throw new ArgumentNullException("DefaultConnection not found");
            _configuration = configuration;
            _logger = logger;
            _databaseService = databaseService;
            _ragService = ragService;
            _httpClient = httpClientFactory.CreateClient();
        }

        private async Task<NpgsqlConnection> GetConnectionAsync()
        {
            var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            return connection;
        }

        private async Task<(HttpResponseMessage response, string body)> PostWithRetryAsync(string url, string json)
        {
            int retryCount = 0;
            const int maxRetries = 3;
            HttpResponseMessage response = null;
            string body = null;

            while (retryCount <= maxRetries)
            {
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                response = await _httpClient.PostAsync(url, content);
                body = await response.Content.ReadAsStringAsync();

                if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests && retryCount < maxRetries)
                {
                    retryCount++;
                    int delay = (int)Math.Pow(2, retryCount) * 1000 + new Random().Next(0, 500); // Exponential backoff + jitter
                    _logger.LogWarning("Gemini API Rate Limit (429). Retry {Count}/{Max} in {Delay}ms...", retryCount, maxRetries, delay);
                    await Task.Delay(delay);
                    continue;
                }
                break;
            }
            return (response, body);
        }

        public async Task<GptChatResponse> ChatAsync(int userId, GptChatRequest request)
        {
            // Existing logic remains for backward compatibility or direct calls
            var sb = new StringBuilder();
            await foreach (var chunk in StreamChatAsync(userId, request))
            {
                sb.Append(chunk);
            }
            
            // Re-fetch conversation details if needed or just return the result
            // To be exactly compatible with original, we'd need to reconstruct the response
            // but for now let's just implement StreamChatAsync effectively.
            return new GptChatResponse { Reply = sb.ToString() }; 
        }

        public async IAsyncEnumerable<string> StreamChatAsync(int userId, GptChatRequest request)
        {
            int convId = 0;
            string fullReply = "";
            NpgsqlConnection connection = null;

            try
            {
                connection = await GetConnectionAsync();
                
                convId = request.ConversationId ?? 0;
                if (convId == 0)
                {
                    convId = await connection.QuerySingleAsync<int>(
                        "INSERT INTO gpt_conversations (user_id, title) VALUES (@UserId, @Title) RETURNING id",
                        new { UserId = userId, Title = request.Message.Split('\n')[0].Substring(0, Math.Min(50, request.Message.Length)) });
                }

                await connection.ExecuteAsync(
                    "INSERT INTO gpt_messages (conversation_id, role, content) VALUES (@ConvId, 'user', @Content)",
                    new { ConvId = convId, Content = request.Message });

                string context = await _ragService.SearchContextAsync(request.Message, request.SelectedDocumentIds);
                
                // If new conversation, send metadata chunk
                if (!request.ConversationId.HasValue)
                {
                    yield return "__METADATA__{\"conversationId\":" + convId + "}";
                }
                var history = (await connection.QueryAsync<GptMessage>(
                    @"SELECT role, content FROM (
                        SELECT role, content, created_at 
                        FROM gpt_messages 
                        WHERE conversation_id = @ConvId 
                        ORDER BY created_at DESC 
                        LIMIT 15
                    ) sub ORDER BY created_at ASC",
                    new { ConvId = convId }))
                    .Where(m => !m.Content.Contains("AI link is busy") && !m.Content.Contains("Error connecting"))
                    .ToList();

                var geminiKey = _configuration["GEMINI_API_KEY"] ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY");
                if (string.IsNullOrEmpty(geminiKey))
                {
                    yield return "Gemini API Key missing.";
                    yield break;
                }

                string systemPrompt = GetSystemPrompt(context);
                
                // Streaming with tools is complex, so we'll do the tool calls first (if any) non-streaming,
                // and then stream the final generation.
                
                _logger.LogInformation("Gpt: Calling CallGeminiWithToolsAsync...");
                var reply = await CallGeminiWithToolsAsync(systemPrompt, history, geminiKey, true);
                _logger.LogInformation("Gpt: Initial reply received. Length: {Len}, StartsWithStream: {IsStream}", reply?.Length ?? 0, reply?.StartsWith("__STREAM__") ?? false);
                
                if (reply != null && reply.StartsWith("__STREAM__"))
                {
                    var streamUrl = $"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:streamGenerateContent?alt=sse&key={geminiKey.Trim()}";
                    var payloadJson = reply.Substring("__STREAM__".Length);
                    
                    _logger.LogInformation("Gpt: Initiating SSE stream to Gemini...");
                    using var streamRequest = new HttpRequestMessage(HttpMethod.Post, streamUrl);
                    streamRequest.Content = new StringContent(payloadJson, Encoding.UTF8, "application/json");
                    
                    using var response = await _httpClient.SendAsync(streamRequest, HttpCompletionOption.ResponseHeadersRead);
                    
                    if (!response.IsSuccessStatusCode)
                    {
                        var err = await response.Content.ReadAsStringAsync();
                        _logger.LogError("Gemini Stream Error ({Status}): {Body}", response.StatusCode, err);
                        yield return $"Error from AI Stream: {response.StatusCode}. Detail: {err}";
                        yield break;
                    }

                    using var stream = await response.Content.ReadAsStreamAsync();
                    using var reader = new System.IO.StreamReader(stream);

                    int chunkCount = 0;
                    while (!reader.EndOfStream)
                    {
                        var line = await reader.ReadLineAsync();
                        if (string.IsNullOrWhiteSpace(line)) continue;
                        if (line.StartsWith("data: "))
                        {
                            var data = line.Substring(6);
                            if (data == "[DONE]") {
                                _logger.LogInformation("Gpt: Stream [DONE] received.");
                                break;
                            }
                            
                            string textToYield = null;
                            try {
                                using var jsonDoc = JsonDocument.Parse(data);
                                if (jsonDoc.RootElement.TryGetProperty("candidates", out var candidates) && candidates.GetArrayLength() > 0)
                                {
                                    var content = candidates[0].GetProperty("content");
                                    if (content.TryGetProperty("parts", out var parts))
                                    {
                                        textToYield = parts[0].GetProperty("text").GetString();
                                    }
                                }
                            } catch (Exception ex) {
                                _logger.LogWarning(ex, "Gpt: Failed to parse stream chunk: {Data}", data);
                            }

                            if (!string.IsNullOrEmpty(textToYield))
                            {
                                fullReply += textToYield;
                                chunkCount++;
                                yield return textToYield;
                            }
                        }
                    }
                    _logger.LogInformation("Gpt: Stream finished. Total chunks yielded: {Count}", chunkCount);
                }
                else
                {
                    _logger.LogInformation("Gpt: Direct response yielded (no stream).");
                    fullReply = reply;
                    yield return reply;
                }

                // Finalize
                if (!string.IsNullOrEmpty(fullReply) && !fullReply.Contains("Rate Limit"))
                {
                    await connection.ExecuteAsync(
                        "INSERT INTO gpt_messages (conversation_id, role, content) VALUES (@ConvId, 'assistant', @Content)",
                        new { ConvId = convId, Content = fullReply });

                    await connection.ExecuteAsync("UPDATE gpt_conversations SET updated_at = NOW() WHERE id = @Id", new { Id = convId });
                }
            }
            finally
            {
                if (connection != null) await connection.DisposeAsync();
            }
        }

        private const string GEMINI_MODEL = "gemini-flash-latest";

        private async Task<string> CallGeminiWithToolsAsync(string systemPrompt, List<GptMessage> history, string apiKey, bool returnPayloadForStreaming = false)
        {
            apiKey = apiKey.Trim();
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={apiKey}";

            var contents = new List<object>();
            foreach (var msg in history)
            {
                contents.Add(new { role = msg.Role == "user" ? "user" : "model", parts = new[] { new { text = msg.Content } } });
            }

            var toolDef = new
            {
                functionDeclarations = new object[]
                {
                    new
                    {
                        name = "query_db",
                        description = "Executes a SELECT SQL query on the NIBSS database to retrieve real-time data about tickets, projects, and incidents.",
                        parameters = new
                        {
                            type = "object",
                            properties = new { sql = new { type = "string", description = "The SQL query to execute. MUST be a SELECT query." } },
                            required = new[] { "sql" }
                        }
                    },
                    new
                    {
                        name = "search_documents",
                        description = "Searches the business documentation library.",
                        parameters = new
                        {
                            type = "object",
                            properties = new { term = new { type = "string", description = "The search term." } },
                            required = new[] { "term" }
                        }
                    }
                }
            };

            var payload = new
            {
                contents = contents,
                tools = new[] { toolDef },
                systemInstruction = new { parts = new[] { new { text = systemPrompt } } },
                generationConfig = new { temperature = 0.2, maxOutputTokens = 1000 }
            };

            if (returnPayloadForStreaming)
            {
                var msg = history.LastOrDefault()?.Content?.ToLower() ?? "";
                bool toolLikely = msg.Contains("select") || msg.Contains("from") || msg.Contains("tickets") || msg.Contains("incidents") || msg.Contains("search") || msg.Contains("context") || msg.Contains("document");
                
                if (!toolLikely)
                {
                    _logger.LogInformation("Gpt: Direct stream triggered for: {Prompt}", msg.Substring(0, Math.Min(20, msg.Length)));
                    return "__STREAM__" + JsonSerializer.Serialize(payload);
                }
            }

            var json = JsonSerializer.Serialize(payload);
            var (response, responseBody) = await PostWithRetryAsync(url, json);
            
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Gemini API Error ({Status}): {Body}", response.StatusCode, responseBody);
                return $"Error connecting to AI (Status: {response.StatusCode}).";
            }

            using var doc = JsonDocument.Parse(responseBody);
            if (!doc.RootElement.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
            {
                return "AI did not provide a response.";
            }

            var firstCandidate = candidates[0];
            if (!firstCandidate.TryGetProperty("content", out var modelContent) || !modelContent.TryGetProperty("parts", out var modelParts))
            {
                return "AI returned an empty content structure.";
            }

            var partsArray = modelParts.EnumerateArray().ToList();
            
            // Add the model's response to contents exactly as received
            var modelMessageParts = new List<object>();
            bool hasFunctionCall = false;

            foreach (var part in partsArray)
            {
                if (part.TryGetProperty("text", out var textProp))
                {
                    modelMessageParts.Add(new { text = textProp.GetString() });
                }
                else if (part.TryGetProperty("functionCall", out var funcCall))
                {
                    hasFunctionCall = true;
                    string ts = null;
                    if (part.TryGetProperty("thoughtSignature", out var tsProp)) ts = tsProp.GetString();
                    
                    modelMessageParts.Add(new { 
                        functionCall = new { 
                            name = funcCall.GetProperty("name").GetString(), 
                            args = funcCall.GetProperty("args") 
                        },
                        thoughtSignature = ts
                    });
                }
            }

            contents.Add(new { role = "model", parts = modelMessageParts });

            if (hasFunctionCall)
            {
                // Execute all function calls in this turn
                foreach (var part in partsArray)
                {
                    if (part.TryGetProperty("functionCall", out var funcCall))
                    {
                        var funcName = funcCall.GetProperty("name").GetString();
                        var args = funcCall.GetProperty("args");
                        
                        _logger.LogInformation("Gpt: Executing tool {Name}", funcName);
                        object result = "No data found.";
                        
                        try {
                            if (funcName == "query_db") {
                                var sql = args.GetProperty("sql").GetString();
                                var rawResult = await _databaseService.QueryRawSqlAsync(sql ?? "");
                                // Convert Dapper results to plain dictionaries for proper JSON serialization
                                result = rawResult.Select(r => (IDictionary<string, object>)r).ToList();
                            } else if (funcName == "search_documents") {
                                var term = args.GetProperty("term").GetString();
                                result = await _ragService.SearchContextAsync(term ?? "");
                            }
                        } catch (Exception ex) {
                            _logger.LogError(ex, "Gpt: Tool execution failed: {Name}", funcName);
                            result = "Error executing tool: " + ex.Message;
                        }

                        contents.Add(new { 
                            role = "function", 
                            parts = new[] { 
                                new { 
                                    functionResponse = new { 
                                        name = funcName, 
                                        response = new { result = result } 
                                    } 
                                } 
                            } 
                        });
                    }
                }
                return await CallGeminiWithToolResultAsync(contents, systemPrompt, apiKey, returnPayloadForStreaming);
            }

            // No function call, just return concatenated text
            var sb = new StringBuilder();
            foreach (var part in partsArray) {
                if (part.TryGetProperty("text", out var textProp)) sb.Append(textProp.GetString());
            }
            return sb.ToString().Trim();
        }

        private async Task<string> CallGeminiWithToolResultAsync(List<object> contents, string systemPrompt, string apiKey, bool returnPayloadForStreaming = false)
        {
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={apiKey.Trim()}";
            var toolDef = new {
                functionDeclarations = new object[] {
                    new { name = "query_db", description = "Query database", parameters = new { type = "object", properties = new { sql = new { type = "string" } } } },
                    new { name = "search_documents", description = "Search docs", parameters = new { type = "object", properties = new { term = new { type = "string" } } } }
                }
            };
            var payload = new {
                contents = contents,
                tools = new[] { toolDef },
                systemInstruction = new { parts = new[] { new { text = systemPrompt } } },
                generationConfig = new { temperature = 0.1 }
            };

            if (returnPayloadForStreaming)
            {
                _logger.LogInformation("Gpt: Handing off to final stream.");
                return "__STREAM__" + JsonSerializer.Serialize(payload);
            }

            var (response, responseBody) = await PostWithRetryAsync(url, JsonSerializer.Serialize(payload));
            if (!response.IsSuccessStatusCode) return "Error fetching final tool response.";

            using var doc = JsonDocument.Parse(responseBody);
            if (!doc.RootElement.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
            {
                return "AI failed to respond after tool execution.";
            }

            var fContent = candidates[0].GetProperty("content");
            var fParts = fContent.GetProperty("parts").EnumerateArray().ToList();
            
            bool hasMoreTools = false;
            var newModelParts = new List<object>();

            foreach (var part in fParts)
            {
                if (part.TryGetProperty("text", out var textProp)) {
                    newModelParts.Add(new { text = textProp.GetString() });
                }
                else if (part.TryGetProperty("functionCall", out var funcCall)) {
                    hasMoreTools = true;
                    string ts = null;
                    if (part.TryGetProperty("thoughtSignature", out var tsProp)) ts = tsProp.GetString();
                    newModelParts.Add(new { 
                        functionCall = new { 
                            name = funcCall.GetProperty("name").GetString(), 
                            args = funcCall.GetProperty("args") 
                        },
                        thoughtSignature = ts
                    });
                }
            }

            contents.Add(new { role = "model", parts = newModelParts });

            if (hasMoreTools)
            {
                foreach (var part in fParts)
                {
                    if (part.TryGetProperty("functionCall", out var funcCall))
                    {
                        var funcName = funcCall.GetProperty("name").GetString();
                        var args = funcCall.GetProperty("args");
                        
                        _logger.LogInformation("Gpt: Executing subsequent tool {Name}", funcName);
                        object result = "No data.";
                        
                        try {
                            if (funcName == "query_db") {
                                var sql = args.GetProperty("sql").GetString();
                                var rawResult = await _databaseService.QueryRawSqlAsync(sql ?? "");
                                result = rawResult.Select(r => (IDictionary<string, object>)r).ToList();
                            } else if (funcName == "search_documents") {
                                var term = args.GetProperty("term").GetString();
                                result = await _ragService.SearchContextAsync(term ?? "");
                            }
                        } catch (Exception ex) {
                            result = "Error: " + ex.Message;
                        }

                        contents.Add(new { 
                            role = "function", 
                            parts = new[] { new { functionResponse = new { name = funcName, response = new { result = result } } } } 
                        });
                    }
                }
                return await CallGeminiWithToolResultAsync(contents, systemPrompt, apiKey, returnPayloadForStreaming);
            }

            var sb = new StringBuilder();
            foreach (var part in fParts) {
                if (part.TryGetProperty("text", out var textProp)) sb.Append(textProp.GetString());
            }
            return sb.ToString().Trim();
        }

        public async Task<List<GptConversationBrief>> GetUserConversationsAsync(int userId)
        {
            using var connection = await GetConnectionAsync();
            var results = await connection.QueryAsync<GptConversationBrief>(
                "SELECT id, title, updated_at as UpdatedAt FROM gpt_conversations WHERE user_id = @UserId ORDER BY updated_at DESC",
                new { UserId = userId });
            return results.ToList();
        }

        public async Task<List<GptMessageDto>> GetConversationHistoryAsync(int conversationId)
        {
            using var connection = await GetConnectionAsync();
            var results = await connection.QueryAsync<GptMessageDto>(
                "SELECT role as Role, content as Content, created_at as CreatedAt FROM gpt_messages WHERE conversation_id = @ConvId ORDER BY created_at ASC",
                new { ConvId = conversationId });
            return results.ToList();
        }

        public async Task<bool> DeleteConversationAsync(int userId, int conversationId)
        {
            using var connection = await GetConnectionAsync();
            var affected = await connection.ExecuteAsync(
                "DELETE FROM gpt_conversations WHERE id = @Id AND user_id = @UserId",
                new { Id = conversationId, UserId = userId });
            return affected > 0;
        }

        public async Task<bool> DeleteAllConversationsAsync(int userId)
        {
            using var connection = await GetConnectionAsync();
            var affected = await connection.ExecuteAsync(
                "DELETE FROM gpt_conversations WHERE user_id = @UserId",
                new { UserId = userId });
            return affected > 0;
        }

        private string GetSystemPrompt(string context)
        {
            return $@"You are NIBSS GPT, a premium AI specialized in Nigeria Inter-Bank Settlement System (NIBSS) IT Governance, Development Operations, and Service Delivery.

GUARDRAILS:
- STRICTLY talk about IT Governance (CAB approvals, SLA, SLR), Software Development (JIRA tickets, projects, sprints), and Service Delivery (Incidents, Freshservice requests).
- REFUSE out-of-context prompts (e.g. general chat, jokes, math, coding help for other languages, personal advice).
- If the user asks something outside the scope, say: 'I am NIBSS GPT, specialized in Governance, Development, and Service Delivery. I cannot assist with that request as it falls outside my corporate mandate.'

DATABASE SCHEMA (Read-only):
- tickets: id (int), jira_key (text), title (text), status (int), complexity (int), risk (int), delivery_points (int), project_id (int), assigned_to (text), created_at (timestamp)
  * Ticket status mapping: 0=TODO, 1=IN_PROGRESS, 2=BLOCKED, 3=REVIEW, 4=DEVOPS, 5=READY_TO_TEST, 6=QA_TEST, 7=SECURITY_TESTING, 8=UAT, 9=CAB_READY, 10=PROD_READY, 11=LIVE
- projects: id (int), jira_key (text), name (text), team_id (int), status (text: 'Active', 'Completed'), description (text), lead (text), start_date (date), target_date (date)
- teams: id (int), name (text)
- incidentsandservice: id (int), freshdesk_id (text), title (text), status (int), priority (text), team (text), institution (text), created_at (timestamp)
  * Incident status mapping: 2=Open, 4=Resolved, 5=Closed.
- service_request_movements: id, incident_id, from_team, to_team, timestamp.

TOOLS:
- query_db(sql): Run SELECT queries. Use LIMIT 10. IMPORTANT: 'status' columns in 'tickets' and 'incidentsandservice' are integers. Projects 'status' is text.
- search_documents(term): Search business context.

CURRENT CONTEXT from Documents:
{context}

Response style: Professional, concise, use Markdown. Always use tables for lists. The current year is {DateTime.UtcNow.Year}.
DATA SCOPE RULE:
- Jira data (tickets table) is only available and relevant for years {DateTime.UtcNow.Year - 1} and {DateTime.UtcNow.Year}.
- Freshservice/Freshdesk data (incidentsandservice table) is only available and relevant for the year {DateTime.UtcNow.Year}.
- Do not attempt to query or discuss data outside these ranges.";
        }
    }
}
