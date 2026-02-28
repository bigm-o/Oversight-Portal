using System.Collections.Generic;
using System.Threading.Tasks;
using TicketTracker.Api.Models.DTOs;

namespace TicketTracker.Api.Services.Interfaces
{
    public interface IGptService
    {
        Task<GptChatResponse> ChatAsync(int userId, GptChatRequest request);
        IAsyncEnumerable<string> StreamChatAsync(int userId, GptChatRequest request);
        Task<List<GptConversationBrief>> GetUserConversationsAsync(int userId);
        Task<List<GptMessageDto>> GetConversationHistoryAsync(int conversationId);
        Task<bool> DeleteConversationAsync(int userId, int conversationId);
        Task<bool> DeleteAllConversationsAsync(int userId);
    }
}
