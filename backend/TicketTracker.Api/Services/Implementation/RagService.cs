using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Linq;
using TicketTracker.Api.Services.Interfaces;
using TicketTracker.Api.Models.Entities;
using TicketTracker.Api.Models.DTOs;
using Dapper;
using Npgsql;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using UglyToad.PdfPig;
using DocumentFormat.OpenXml.Packaging;

namespace TicketTracker.Api.Services.Implementation
{
    public class RagService : IRagService
    {
        private readonly string _connectionString;
        private readonly ILogger<RagService> _logger;

        public RagService(IConfiguration configuration, ILogger<RagService> logger)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection") 
                ?? throw new ArgumentNullException("DefaultConnection not found");
            _logger = logger;
        }

        private async Task<NpgsqlConnection> GetConnectionAsync()
        {
            var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            return connection;
        }

        public async Task<bool> IngestDocumentAsync(int userId, string fileName, Stream fileStream)
        {
            try
            {
                string text = "";
                string extension = Path.GetExtension(fileName).ToLower();

                if (extension == ".pdf")
                {
                    text = ExtractTextFromPdf(fileStream);
                }
                else if (extension == ".docx")
                {
                    text = ExtractTextFromDocx(fileStream);
                }
                else if (extension == ".txt")
                {
                    using var reader = new StreamReader(fileStream);
                    text = await reader.ReadToEndAsync();
                }
                else
                {
                    throw new NotSupportedException("File type not supported");
                }

                if (string.IsNullOrWhiteSpace(text)) return false;

                using var connection = await GetConnectionAsync();
                using var transaction = await connection.BeginTransactionAsync();

                // 1. Create document record
                var docId = await connection.QuerySingleAsync<int>(
                    "INSERT INTO gpt_documents (title, file_path, uploaded_by) VALUES (@Title, @Path, @UserId) RETURNING id",
                    new { Title = fileName, Path = fileName, UserId = userId },
                    transaction);

                // 2. Chunk text
                var chunks = ChunkText(text, 1000, 200);
                
                // 3. Insert chunks
                var insertSql = "INSERT INTO gpt_document_chunks (document_id, content, chunk_index) VALUES (@DocId, @Content, @Index)";
                foreach (var (chunk, index) in chunks.Select((c, i) => (c, i)))
                {
                    await connection.ExecuteAsync(insertSql, new { DocId = docId, Content = chunk, Index = index }, transaction);
                }

                await transaction.CommitAsync();
                _logger.LogInformation("Ingested document {FileName} with {ChunkCount} chunks", fileName, chunks.Count);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error ingesting document {FileName}", fileName);
                return false;
            }
        }

        public async Task<string> SearchContextAsync(string query, List<int>? docIds = null)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(query) && (docIds == null || docIds.Count == 0)) return "";

                using var connection = await GetConnectionAsync();
                
                // Optimized Rank-based Search using Postgres Full-Text Engine
                var sql = @"
                    SELECT content 
                    FROM gpt_document_chunks, websearch_to_tsquery('english', @Query) query
                    WHERE (to_tsvector('english', content) @@ query OR content ILIKE ANY(@Terms))";

                var parameters = new DynamicParameters();
                parameters.Add("Query", query);
                
                var terms = query.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                                 .Select(t => $"%{t}%")
                                 .ToArray();
                parameters.Add("Terms", terms);

                if (docIds != null && docIds.Count > 0)
                {
                    sql += " AND document_id = ANY(@DocIds)";
                    parameters.Add("DocIds", docIds);
                }

                sql += " ORDER BY ts_rank_cd(to_tsvector('english', content), query) DESC LIMIT 10";

                var results = await connection.QueryAsync<string>(sql, parameters);
                
                if (!results.Any()) return "";

                return "Relevant context from business documents (Ranked):\n" + string.Join("\n---\n", results);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching context for: {Query}", query);
                return "";
            }
        }

        private string ExtractTextFromPdf(Stream stream)
        {
            var sb = new StringBuilder();
            using (var pkg = PdfDocument.Open(stream))
            {
                foreach (var page in pkg.GetPages())
                {
                    sb.AppendLine(page.Text);
                }
            }
            return sb.ToString();
        }

        private string ExtractTextFromDocx(Stream stream)
        {
            var sb = new StringBuilder();
            using (WordprocessingDocument wordDoc = WordprocessingDocument.Open(stream, false))
            {
                var body = wordDoc.MainDocumentPart?.Document.Body;
                if (body != null)
                {
                    sb.Append(body.InnerText);
                }
            }
            return sb.ToString();
        }

        private List<string> ChunkText(string text, int chunkSize, int overlap)
        {
            var chunks = new List<string>();
            if (string.IsNullOrWhiteSpace(text)) return chunks;

            int start = 0;
            while (start < text.Length)
            {
                int length = Math.Min(chunkSize, text.Length - start);
                chunks.Add(text.Substring(start, length));
                start += (chunkSize - overlap);
                if (start >= text.Length) break;
            }

            return chunks;
        }
        public async Task<IEnumerable<GptDocumentBrief>> GetDocumentsAsync()
        {
            try
            {
                using var connection = await GetConnectionAsync();
                return await connection.QueryAsync<GptDocumentBrief>(
                    "SELECT id, title, created_at as CreatedAt FROM gpt_documents ORDER BY created_at DESC");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching documents");
                return Enumerable.Empty<GptDocumentBrief>();
            }
        }
        public async Task<bool> DeleteDocumentAsync(int docId)
        {
            try
            {
                using var connection = await GetConnectionAsync();
                var rows = await connection.ExecuteAsync("DELETE FROM gpt_documents WHERE id = @Id", new { Id = docId });
                return rows > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting document {DocId}", docId);
                return false;
            }
        }
    }
}
