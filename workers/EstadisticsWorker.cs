using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

public class EstadisticasWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<EstadisticasWorker> _logger;
    private readonly TimeSpan _periodo = TimeSpan.FromMinutes(5); // Frecuencia de ejecución

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


                    var timeStamp = DateTime.UtcNow.AddMinutes(-5);

    
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

                    if (!estadisticsPerPc.Any())
                    {
                        continue;
                    }

                    // 2. Traer en memoria las entidades de ClientComputer involucradas
                    var pcIds = estadisticsPerPc.Select(x => x.PcId).ToList();
                    var clientComputers = await dbContext.ClientComputers
                        .Where(c => pcIds.Contains(c.Id))
                        .ToDictionaryAsync(c => c.Id, stoppingToken);



                    foreach (var stat in estadisticsPerPc)
                    {
                            var newStatus = EvaluatedComputerStatus(stat);

                            if (clientComputers.TryGetValue(stat.PcId, out var clientComputer))
                            {
                                if ((ComputerStatus)clientComputer.Status != newStatus)
                                {
                                    _logger.LogWarning("Cambio de estado en ClientComputer {PcId}: {EstadoAnterior} -> {NuevoEstado}", 
                                        clientComputer.Id, clientComputer.Status, newStatus);

                                    clientComputer.Status = (int)newStatus;
                                }
                            }
                        
                        // 4. Guardar inserciones de estadísticas y actualizaciones de estado en una sola transacción
                        await dbContext.ClientStatistics.AddRangeAsync(estadisticsPerPc, stoppingToken);
                        await dbContext.SaveChangesAsync(stoppingToken);

                        _logger.LogInformation("Métricas e historial de estado guardados para {Count} equipos.", estadisticsPerPc.Count);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ocurrió un error al recolectar las estadísticas.");
            }
        }
    }
    private ComputerStatus EvaluatedComputerStatus(ClientStatistics stats)
    {
        if (stats.TempMax >= 85.0 || stats.CpuMax >= 98.0 || stats.RamMean >= 95.0)
        {
            return ComputerStatus.Critical;
        }

        if (stats.TempMean >= 75.0 || stats.CpuMean >= 80.0 || stats.RamMean >= 85.0)
        {
            return ComputerStatus.NeedMaintenance;
        }

        return ComputerStatus.Online;
    }
}