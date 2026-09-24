public record EnrollClientComputerDto
{
    public string HostName {get; set;} = string.Empty;
    public string IpAddress {get; set;} = string.Empty;
    public string MacAddress {get; set;} = string.Empty;
    public string Uuid {get; set;} = string.Empty;
}