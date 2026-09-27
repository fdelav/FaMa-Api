using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;


public static class NotificationEndPoints
{
	public static IEndpointRouteBuilder MapNotificationEndpoints(
		this IEndpointRouteBuilder endpoints)
	{
		var group = endpoints
			.MapGroup("/api/notifications")
			.WithTags("Notifications");

		group.MapGet("/", GetNotifications);
        group.MapPatch("/read", ReadNotifications);
    

		return endpoints;
	}

	private static async Task<IResult> GetNotifications(bool? unreadOnly,AppDbContext db) 
    {   
		var query = db.Notifications.AsQueryable();

        if (unreadOnly.HasValue && unreadOnly.Value)
        {
            query = query.Where(n => n.IsRead == 0);
        }

        var notifications = await query.ToListAsync();
        

        return Results.Ok(notifications);
    }

    private static async Task<IResult> ReadNotifications(AppDbContext db) 
    {
        var updatedRows = await db.Notifications
        .Where(n => n.IsRead == 0)
        .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, 1));

        return Results.Ok(new { updated = updatedRows });   
    }


	
}
