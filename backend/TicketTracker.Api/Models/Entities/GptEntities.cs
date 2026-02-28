using System;
using System.Collections.Generic;

namespace TicketTracker.Api.Models.Entities
{
    public class GptConversation
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string Title { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    public class GptMessage
    {
        public int Id { get; set; }
        public int ConversationId { get; set; }
        public string Role { get; set; } = string.Empty; // "user" or "assistant"
        public string Content { get; set; } = string.Empty;
        public string? ToolCalls { get; set; } // JSON serialized tool calls
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class GptDocument
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string FilePath { get; set; } = string.Empty;
        public int? UploadedBy { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class GptDocumentChunk
    {
        public int Id { get; set; }
        public int DocumentId { get; set; }
        public string Content { get; set; } = string.Empty;
        public int ChunkIndex { get; set; }
    }
}
