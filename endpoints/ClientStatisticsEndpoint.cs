using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;


public static class ClientStatisticsEndpoint
{
	public static IEndpointRouteBuilder MapClientStatisticsEndpoint(this IEndpointRouteBuilder app)
	{
        var adminGroup = app.MapGroup("/agent/clientstatistics");

		adminGroup.MapGet("/", GetClientStatistics);
        adminGroup.MapDelete("/{id}", DeleteClientStatistics);
        

		return app;
	}

	private static async Task<IResult> GetClientStatistics(AppDbContext db)
	{
		var statistics = await db.ClientStatistics.ToListAsync();
		return Results.Ok(statistics);
	}

    private static async Task<IResult> DeleteClientStatistics(AppDbContext db, int id)
    {
        var statistics = await db.ClientStatistics.FindAsync(id);
        if (statistics == null)
        {
            return Results.NotFound();
        }

        db.ClientStatistics.Remove(statistics);
        await db.SaveChangesAsync();

        return Results.Ok();
    }
}
