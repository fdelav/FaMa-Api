using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;


public static class NotificationEndPoints
{
	public static IEndpointRouteBuilder MapNotificationEndpoints(this IEndpointRouteBuilder app)
	{
		var group = app
			.MapGroup("/api/notifications")
			.WithTags("Notifications")
            .RequireAuthorization();

		group.MapGet("/", GetNotifications);
        group.MapGet("/pc/{pcId}", GetNotificationByPcId);
        group.MapPatch("/read", ReadNotifications);
        group.MapPatch("/read-batch", ReadBatchNotifications);
    

		return app;
	}

    private record NotificationParameters(
        bool? isRead,
        DateTime? startDate,
        DateTime? endDate,
        string? notificationType,
        int? pcId, 
        string? pcLocation,
        int page = 1,
        int pageSize = 10
    );

	private static async Task<IResult> GetNotifications([AsParameters] NotificationParameters parameters, AppDbContext db) 
    {   
		var query = db.Notifications.AsQueryable();

        if (parameters.isRead.HasValue)
        {
            query = query.Where(n => n.IsRead == (parameters.isRead.Value ? 1 : 0));
        }

        if (parameters.startDate.HasValue)
        {
            query = query.Where(n => n.CreatedAt >= parameters.startDate.Value);
        }

        if (parameters.endDate.HasValue)
        {
            query = query.Where(n => n.CreatedAt <= parameters.endDate.Value);
        }

        if (!string.IsNullOrEmpty(parameters.notificationType))
        {
            query = query.Where(n => n.Type == parameters.notificationType);
        }

        if (parameters.pcId.HasValue)
        {
            query = query.Where(n => n.PcId == parameters.pcId.Value);
        }

        if (!string.IsNullOrEmpty(parameters.pcLocation))
        {
            query = query.Where(n => db.ClientComputers.Any(c => c.Id == n.PcId && c.Location == parameters.pcLocation));
        }

        var notifications = await query
            .Skip((parameters.page - 1) * parameters.pageSize)
            .Take(parameters.pageSize)
            .ToListAsync();

        return Results.Ok(notifications);
    }

    private static async Task<IResult> GetNotificationByPcId(int pcId, AppDbContext db, int page = 1, int pageSize = 10) 
    {
        var notifications = await db.Notifications
            .Where(n => n.PcId == pcId)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        if (notifications == null || notifications.Count == 0)
        {
            return Results.NotFound(new { message = "No notifications found for the specified PC ID." });
        }

        return Results.Ok(notifications);
    }

    private static async Task<IResult> ReadNotifications(AppDbContext db) 
    {
        var updatedRows = await db.Notifications
        .Where(n => n.IsRead == 0)
        .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, 1));

        return Results.Ok(new { updated = updatedRows });   
    }

    private static async Task<IResult> ReadBatchNotifications(AppDbContext db, List<int> notificationIds) 
    {
        if (notificationIds == null || notificationIds.Count == 0)
        {
            return Results.BadRequest(new { message = "No notification IDs provided." });
        }
        var updatedRows = await db.Notifications
        .Where(n => notificationIds.Contains(n.Id) && n.IsRead == 0)
        .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, 1));

        return Results.Ok(new { updated = updatedRows });   
    }


	
}
