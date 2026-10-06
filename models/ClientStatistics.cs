public class ClientStatistics
{
	public int Id { get; set; }
	public int PcId { get; set; }

	public double RamMean { get; set; } = 0;
	public double RamMax { get; set; } = 0;

	public double CpuMean { get; set; } = 0;
	public double CpuMax { get; set; } = 0;

	public double GpuMean { get; set; } = 0;
	public double GpuMax { get; set; } = 0;

	public double TempMean { get; set; } = 0;
	public double TempMax { get; set; } = 0;
	public ComputerHealth ComputerHealth { get; set; } = ComputerHealth.Healthy;
	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
