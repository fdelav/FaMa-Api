public class ClientComputer
{
    public int Id {get; set;}
    public string HostName {get; set;} = string.Empty;
    public string IpAddress {get; set;} = string.Empty;
    public string MacAddress {get; set;} = string.Empty;
    public string Uuid {get; set;} = string.Empty;
    public DateTime LastEnrollment {get; set;} = DateTime.UtcNow;
    public DateTime LastStatusReport {get; set;} = DateTime.UtcNow;
    public int Status {get; set;} = 0;
}