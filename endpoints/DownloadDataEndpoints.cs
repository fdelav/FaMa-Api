using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.IO.Compression;
using System.Text;
public static class DownloadDataEndpoints
{
    public static IEndpointRouteBuilder MapDownloadDataEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/download").WithTags("Download Data").RequireAuthorization();

        group.MapGet("/export-zip", ExportDataAsZip);

        return app;
    }

    private static async Task<IResult> ExportDataAsZip(AppDbContext db, HttpContext context)
    {
        var syncIoFeature = context.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpBodyControlFeature>();
        if (syncIoFeature != null)
        {
            syncIoFeature.AllowSynchronousIO = true;
        }

        context.Response.ContentType = "application/zip";
        context.Response.Headers["Content-Disposition"] = "attachment; filename=informe_completo.zip";
        using (var archive = new ZipArchive(context.Response.Body, ZipArchiveMode.Create, leaveOpen: true))
        {
            var entryStatusReport = archive.CreateEntry("status-report.csv");
            // ==========================================
            // 1. USER FORMS CSV
            // ==========================================
            var entryUserForm = archive.CreateEntry("user_forms.csv");
            using (var writer = new StreamWriter(entryUserForm.Open(), Encoding.UTF8))
            {
                await writer.WriteLineAsync("Id,Email,IdPc,Location,PcCode,Ticket,Description,CreatedAt");

                await foreach (var item in db.UserForms.AsNoTracking().AsAsyncEnumerable())
                {
                    // Limpiamos y escapamos comillas en los textos por seguridad del CSV
                    string desc = EscapeCsv(item.Description);
                    string loc = EscapeCsv(item.Location);
                    string code = EscapeCsv(item.PcCode);
                    string ticket = EscapeCsv(item.Ticket);

                    await writer.WriteLineAsync($"{item.Id},{item.Email},{item.IdPc},{loc},{code},{ticket},{desc},{item.CreatedAt:yyyy-MM-dd HH:mm:ss}");
                }
            }

            // ==========================================
            // 2. CLIENT COMPUTERS CSV
            // ==========================================
            var entryComputer = archive.CreateEntry("client_computers.csv");
            using (var writer = new StreamWriter(entryComputer.Open(), Encoding.UTF8))
            {
                await writer.WriteLineAsync("Id,HostName,IpAddress,MacAddress,Uuid,Location,LastEnrollment,LastStatusReport,Status,ReportApiKey,usageCode,usageCodeExpiration");

                await foreach (var item in db.ClientComputers.AsNoTracking().AsAsyncEnumerable())
                {
                    string loc = EscapeCsv(item.Location);
                    string usage = EscapeCsv(item.usageCode);

                    await writer.WriteLineAsync($"{item.Id},{item.HostName},{item.IpAddress},{item.MacAddress},{item.Uuid},{loc},{item.LastEnrollment:yyyy-MM-dd HH:mm:ss},{item.LastStatusReport:yyyy-MM-dd HH:mm:ss},{item.Status},{item.ReportApiKey},{usage},{item.usageCodeExpiration:yyyy-MM-dd HH:mm:ss}");
                }
            }

            // ==========================================
            // 3. CLIENT STATISTICS CSV
            // ==========================================
            var entryStats = archive.CreateEntry("client_statistics.csv");
            using (var writer = new StreamWriter(entryStats.Open(), Encoding.UTF8))
            {
                await writer.WriteLineAsync("Id,PcId,RamMean,RamMax,CpuMean,CpuMax,GpuMean,GpuMax,TempMean,TempMax,DiskActivityMean,DiskActivityMax,DiskResponseMsMean,DiskResponseMsMax,ComputerHealth,CreatedAt");

                await foreach (var item in db.ClientStatistics.AsNoTracking().AsAsyncEnumerable())
                {
                    await writer.WriteLineAsync($"{item.Id},{item.PcId},{item.RamMean},{item.RamMax},{item.CpuMean},{item.CpuMax},{item.GpuMean},{item.GpuMax},{item.TempMean},{item.TempMax},{item.DiskActivityMean},{item.DiskActivityMax},{item.DiskResponseMsMean},{item.DiskResponseMsMax},{item.ComputerHealth},{item.CreatedAt:yyyy-MM-dd HH:mm:ss}");
                }
            }

            // ==========================================
            // 4. NOTIFICATIONS CSV
            // ==========================================
            var entryNotif = archive.CreateEntry("notifications.csv");
            using (var writer = new StreamWriter(entryNotif.Open(), Encoding.UTF8))
            {
                await writer.WriteLineAsync("Id,PcId,Message,Type,IsRead,CreatedAt");

                await foreach (var item in db.Notifications.AsNoTracking().AsAsyncEnumerable())
                {
                    string msg = EscapeCsv(item.Message);
                    string type = EscapeCsv(item.Type);

                    await writer.WriteLineAsync($"{item.Id},{item.PcId},{msg},{type},{item.IsRead},{item.CreatedAt:yyyy-MM-dd HH:mm:ss}");
                }
            }

            // ==========================================
            // 5. STATUS REPORTS CSV
            // ==========================================
            var entryStatusRep = archive.CreateEntry("status_reports.csv");
            using (var writer = new StreamWriter(entryStatusRep.Open(), Encoding.UTF8))
            {
                await writer.WriteLineAsync("Id,PcId,Ram,Cpu,Gpu,Temp,DiskActivity,DiskResponseMs,CreatedAt");

                await foreach (var item in db.StatusReports.AsNoTracking().AsAsyncEnumerable())
                {
                    await writer.WriteLineAsync($"{item.Id},{item.PcId},{item.Ram},{item.Cpu},{item.Gpu},{item.Temp},{item.DiskActivity},{item.DiskResponseMs},{item.CreatedAt:yyyy-MM-dd HH:mm:ss}");
                }
            }
        }

        return Results.Empty;
    }

    static string EscapeCsv(string? input)
{
    if (string.IsNullOrEmpty(input)) return string.Empty;
    // Si contiene comas o comillas, lo envolvemos en comillas dobles escapando las internas
    if (input.Contains(',') || input.Contains('"') || input.Contains('\n') || input.Contains('\r'))
    {
        return $"\"{input.Replace("\"", "\"\"")}\"";
    }
    return input;
}
}