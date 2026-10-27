using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

// Endpoint de SOLO LECTURA para el panel de detalle de equipo del dashboard.
// Archivo nuevo e independiente: no modifica ningún endpoint ni modelo existente.
// Devuelve en una sola llamada la info del equipo + sus últimos reportes, estadísticas y notificaciones.
// A propósito NO incluye ReportApiKey ni usageCode del equipo.
public static class EquipoDetalleEndpoints
{
    public static IEndpointRouteBuilder MapEquipoDetalleEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app
            .MapGroup("/admin/equipo-detalle")
            .WithTags("EquipoDetalle")
            .RequireAuthorization();

        group.MapGet("/{pcId:int}", GetDetalle);

        return app;
    }

    private static async Task<IResult> GetDetalle(
        int pcId,
        AppDbContext db,
        int reportes = 60,
        int estadisticas = 12,
        int notificaciones = 10)
    {
        reportes = Math.Clamp(reportes, 1, 500);
        estadisticas = Math.Clamp(estadisticas, 1, 200);
        notificaciones = Math.Clamp(notificaciones, 1, 100);

        var equipo = await db.ClientComputers
            .AsNoTracking()
            .Where(c => c.Id == pcId)
            .Select(c => new
            {
                c.Id,
                c.HostName,
                c.IpAddress,
                c.MacAddress,
                c.Uuid,
                c.Location,
                c.LastEnrollment,
                c.LastStatusReport,
                c.Status
            })
            .FirstOrDefaultAsync();

        if (equipo is null)
        {
            return Results.NotFound(new { message = "El equipo indicado no existe." });
        }

        var ultimosReportes = await db.StatusReports
            .AsNoTracking()
            .Where(r => r.PcId == pcId)
            .OrderByDescending(r => r.CreatedAt)
            .Take(reportes)
            .ToListAsync();

        var ultimasEstadisticas = await db.ClientStatistics
            .AsNoTracking()
            .Where(s => s.PcId == pcId)
            .OrderByDescending(s => s.CreatedAt)
            .Take(estadisticas)
            .ToListAsync();

        var ultimasNotificaciones = await db.Notifications
            .AsNoTracking()
            .Where(n => n.PcId == pcId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(notificaciones)
            .ToListAsync();

        return Results.Ok(new
        {
            equipo,
            reportes = ultimosReportes,
            estadisticas = ultimasEstadisticas,
            notificaciones = ultimasNotificaciones
        });
    }
}
