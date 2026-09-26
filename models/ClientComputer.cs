public class ClientComputer
{
    public int Id {get; set;}
    public string HostName {get; set;} = string.Empty;
    public string IpAddress {get; set;} = string.Empty;
    public string MacAddress {get; set;} = string.Empty;
    public string Uuid {get; set;} = string.Empty;
    public string? Location {get; set;}
    public DateTime LastEnrollment {get; set;} = DateTime.UtcNow;
    public DateTime LastStatusReport {get; set;} = DateTime.UtcNow;
    public int Status {get; set;} = 0;

    public Guid? ReportApiKey {get; set;}
    public string? usageCode {get; set;}
    public DateTime? usageCodeExpiration {get; set;}    
}