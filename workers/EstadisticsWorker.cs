using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

public class EstadisticasWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<EstadisticasWorker> _logger;
    private readonly TimeSpan _periodo = TimeSpan.FromSeconds(5); // Frecuencia de ejecución

    public EstadisticasWorker(IServiceScopeFactory scopeFactory, ILogger<EstadisticasWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using PeriodicTimer timer = new PeriodicTimer(_periodo);

        // Bucle que corre hasta que la aplicación se detenga
        while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                _logger.LogInformation("Iniciando recolección de estadísticas a las: {time}", DateTimeOffset.Now);

                // Crear un scope explícito para resolver servicios Scoped como DbContext
                using (var scope = _scopeFactory.CreateScope())
                {
                    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();


                    var timeStamp = DateTime.UtcNow.AddSeconds(-5);

    
                    var estadisticsPerPc = await dbContext.StatusReports
                        .GroupBy(cs => cs.PcId)
                        .Select(g => new ClientStatistics
                        {
                            PcId = g.Key,
                            RamMean = g.Average(cs => cs.Ram),
                            RamMax = g.Max(cs => cs.Ram),
                            CpuMean = g.Average(cs => cs.Cpu),
                            CpuMax = g.Max(cs => cs.Cpu),
                            GpuMean = g.Average(cs => cs.Gpu),
                            GpuMax = g.Max(cs => cs.Gpu),
                            TempMean = g.Average(cs => cs.Temp),
                            TempMax = g.Max(cs => cs.Temp),
                        })
                        .ToListAsync(stoppingToken);

                    if (estadisticsPerPc.Any())
                    {
                        await dbContext.ClientStatistics.AddRangeAsync(estadisticsPerPc, stoppingToken);
                        await dbContext.SaveChangesAsync(stoppingToken);

                        _logger.LogInformation("Se guardaron estadísticas para {count} equipos correctamente.", estadisticsPerPc.Count);
                    }
                    else
                    {
                        _logger.LogInformation("No se encontraron reportes para procesar.");
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ocurrió un error al recolectar las estadísticas.");
            }
        }
    }
}