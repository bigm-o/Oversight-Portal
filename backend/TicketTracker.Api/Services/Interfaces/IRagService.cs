using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using TicketTracker.Api.Models.DTOs;

namespace TicketTracker.Api.Services.Interfaces
{
    public interface IRagService
    {
        Task<bool> IngestDocumentAsync(int userId, string fileName, Stream fileStream);
        Task<string> SearchContextAsync(string query, List<int>? docIds = null);
        Task<IEnumerable<GptDocumentBrief>> GetDocumentsAsync();
        Task<bool> DeleteDocumentAsync(int docId);
    }
}
