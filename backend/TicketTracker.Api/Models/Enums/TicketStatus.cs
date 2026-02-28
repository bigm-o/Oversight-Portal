namespace TicketTracker.Api.Models.Enums;

public enum TicketStatus
{
    TODO = 0,
    IN_PROGRESS = 1,
    BLOCKED = 2,
    REVIEW = 3,
    DEVOPS = 4,
    READY_TO_TEST = 5,
    QA_TEST = 6,
    SECURITY_TESTING = 7,
    UAT = 8,
    CAB_READY = 9,
    PRODUCTION_READY = 10,
    LIVE = 11,
    ROLLBACK = 12
}