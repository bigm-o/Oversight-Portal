using Microsoft.AspNetCore.Mvc;
using TicketTracker.Api.Services.Interfaces;
using TicketTracker.Api.Models.DTOs;

namespace TicketTracker.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class GovernanceAnalyticsController : ControllerBase
    {
        private readonly IDatabaseService _databaseService;
        private readonly ILogger<GovernanceAnalyticsController> _logger;

        public GovernanceAnalyticsController(IDatabaseService databaseService, ILogger<GovernanceAnalyticsController> logger)
        {
            _databaseService = databaseService;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<GovernanceAnalyticsResponse>> GetAnalytics([FromQuery] AnalyticsFilter filter)
        {
            try
            {
                _logger.LogInformation("Governance Analytics requested with filters: {@Filter}", filter);
                var analytics = await _databaseService.GetGovernanceAnalyticsAsync(filter);
                return Ok(analytics);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching governance analytics");
                return StatusCode(500, "Error fetching governance analytics");
            }
        }

        [HttpPost("repopulate-institutions")]
        public async Task<IActionResult> RepopulateInstitutions()
        {
            try
            {
                _logger.LogInformation("Repopulating institutions field manually");
                var tickets = await _databaseService.GetIncidentsAsync();
                int count = 0;
                
                // Note: GetIncidentsAsync returns List<Incident>. 
                // We actually need to work with the incidentsandservice table directly or update the entity.
                // For simplicity, I'll run a raw update SQL.
                
                var sql = @"
                    UPDATE incidentsandservice 
                    SET institution = CASE 
                        WHEN requester_email ILIKE '%accessbankplc.com' OR requester_email ILIKE '%accessbank.com' THEN 'Access Bank'
                        WHEN requester_email ILIKE '%zenithbank.com' THEN 'Zenith Bank'
                        WHEN requester_email ILIKE '%gtbank.com' OR requester_email ILIKE '%gtco.co' THEN 'GTBank'
                        WHEN requester_email ILIKE '%firstbanknigeria.com' THEN 'FirstBank'
                        WHEN requester_email ILIKE '%ubagroup.com' THEN 'UBA'
                        WHEN requester_email ILIKE '%fcmb.com' THEN 'FCMB'
                        WHEN requester_email ILIKE '%unionbankng.com' THEN 'Union Bank'
                        WHEN requester_email ILIKE '%stanbicibtc.com' THEN 'Stanbic IBTC'
                        WHEN requester_email ILIKE '%sterling.ng' THEN 'Sterling Bank'
                        WHEN requester_email ILIKE '%fidelitybank.ng' THEN 'Fidelity Bank'
                        WHEN requester_email ILIKE '%wemaplc.com' THEN 'Wema Bank'
                        WHEN requester_email ILIKE '%polarisbanklimited.com' THEN 'Polaris Bank'
                        WHEN requester_email ILIKE '%unitybankng.com' THEN 'Unity Bank'
                        WHEN requester_email ILIKE '%nibss-plc.com.ng' THEN 'NIBSS'
                        ELSE 'Other'
                    END
                    WHERE institution IS NULL OR institution = '' OR institution = 'Other'";
                
                await _databaseService.ExecuteRawSqlAsync(sql);
                
                return Ok(new { message = "Institutions repopulated successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error repopulating institutions");
                return StatusCode(500, "Error repopulating institutions");
            }
        }
    }
}
