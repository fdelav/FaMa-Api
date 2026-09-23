using Microsoft.EntityFrameworkCore;
using FaMaApi.Dtos;

public static class StatusReportEndpoint
{
    public static void MapStatusReportEndpoint(this IEndpointRouteBuilder app)
    {
        var statusReportGroup = app.MapGroup("/statusreport");

        statusReportGroup.MapGet("/", GetTodos);
        statusReportGroup.MapGet("/{id}", GetById);
        statusReportGroup.MapPost("/", Create);
        statusReportGroup.MapPost("/batch", CreateBatch);
        statusReportGroup.MapPut("/{id}", Update);
        statusReportGroup.MapDelete("/{id}", Delete);
    }

    private static async Task<IResult> GetTodos(AppDbContext db)
    {
        var statusReports = await db.StatusReports.ToListAsync();
        return Results.Ok(statusReports);
    }

    private static async Task<IResult> GetById(int id, AppDbContext db)
    {
        var statusReport = await db.StatusReports.FindAsync(id);
        return statusReport != null ? Results.Ok(statusReport) : Results.NotFound();
    }

    private static async Task<IResult> Create(CreateStatusReportDto statusReportDto, AppDbContext db)
    {
        var statusReport = new StatusReport
        {
            PcId = statusReportDto.PcId,
            Ram = statusReportDto.Ram,
            Cpu = statusReportDto.Cpu,
            Gpu = statusReportDto.Gpu,
            Temp = statusReportDto.Temp,
            CreatedAt = statusReportDto.CreatedAt ?? DateTime.UtcNow
        };

        db.StatusReports.Add(statusReport);
        await db.SaveChangesAsync();
        return Results.Created($"/statusreport/{statusReport.Id}", statusReport);
    }

    private static async Task<IResult> CreateBatch(BatchStatusReportDto batchStatusReportDto, AppDbContext db)
    {
        var statusReports = batchStatusReportDto.StatusReports.Select(dto => new StatusReport
        {
            PcId = dto.PcId,
            Ram = dto.Ram,
            Cpu = dto.Cpu,
            Gpu = dto.Gpu,
            Temp = dto.Temp,
            CreatedAt = dto.CreatedAt ?? DateTime.UtcNow
        }).ToList();

        await db.StatusReports.AddRangeAsync(statusReports);
        await db.SaveChangesAsync();
        return Results.Created("/statusreport/batch", statusReports);
    }

    private static async Task<IResult> Update(int id, StatusReport statusReport, AppDbContext db)
    {
        var existingStatusReport = await db.StatusReports.FindAsync(id);
        if (existingStatusReport == null)
        {
            return Results.NotFound();
        }

        existingStatusReport.PcId = statusReport.PcId;
        existingStatusReport.Ram = statusReport.Ram;
        existingStatusReport.Cpu = statusReport.Cpu;
        existingStatusReport.Gpu = statusReport.Gpu;
        existingStatusReport.Temp = statusReport.Temp;
        existingStatusReport.CreatedAt = statusReport.CreatedAt;

        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    private static async Task<IResult> Delete(int id, AppDbContext db)
    {
        var statusReport = await db.StatusReports.FindAsync(id);
        if (statusReport == null)
        {
            return Results.NotFound();
        }

        db.StatusReports.Remove(statusReport);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }
}