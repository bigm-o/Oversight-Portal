namespace TicketTracker.Api.Exceptions;

public class UserDeactivatedException : Exception
{
    public UserDeactivatedException(string email) : base($"User {email} is deactivated") { }
}
