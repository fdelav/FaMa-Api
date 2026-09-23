namespace FaMaApi.Dtos;
public record CreateStatusReportDto
{
    public int PcId {get; set;}
    public float Ram {get; set;}
    public float Cpu {get; set;}
    public float Gpu {get; set;}
    public float Temp {get; set;}
    public DateTime? CreatedAt {get; set;} = DateTime.UtcNow;
}