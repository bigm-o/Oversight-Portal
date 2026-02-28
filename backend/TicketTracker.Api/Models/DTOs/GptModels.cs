using System.Collections.Generic;

namespace TicketTracker.Api.Models.DTOs
{
    public class GptChatRequest
    {
        public int? ConversationId { get; set; }
        public string Message { get; set; } = string.Empty;
        public List<int>? SelectedDocumentIds { get; set; }
    }

    public class GptChatResponse
    {
        public int ConversationId { get; set; }
        public string Reply { get; set; } = string.Empty;
        public List<GptMessageDto> History { get; set; } = new();
    }

    public class GptMessageDto
    {
        public string Role { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public class GptConversationBrief
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public DateTime UpdatedAt { get; set; }
    }

    public class GptDocumentBrief
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }
}
