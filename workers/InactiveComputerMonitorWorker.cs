using Microsoft.EntityFrameworkCore;
public class InactiveComputerMonitorWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<InactiveComputerMonitorWorker> _logger;
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan TimeoutThreshold = TimeSpan.FromMinutes(15);

    public InactiveComputerMonitorWorker(
        IServiceScopeFactory scopeFactory, 
        ILogger<InactiveComputerMonitorWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Un PeriodicTimer es ideal para iteraciones limpias sin desfasaje de tiempo
        using var timer = new PeriodicTimer(Interval);

        while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                var cutoffTime = DateTime.UtcNow.Subtract(TimeoutThreshold);

                // Consulta y actualiza los equipos superados en el umbral
                var offlineCount = await dbContext.ClientComputers
                    .Where(c => c.Status != (int)ComputerStatus.Offline && c.Status != (int)ComputerStatus.NoEnrolled && c.LastStatusReport <= cutoffTime)
                    .ExecuteUpdateAsync(s => s.SetProperty(c => c.Status, (int)ComputerStatus.Offline), stoppingToken);

                if (offlineCount > 0)
                {
                    _logger.LogInformation("Se marcaron {Count} equipos como Offline por inactividad.", offlineCount);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al verificar equipos desconectados.");
            }
        }
    }
}