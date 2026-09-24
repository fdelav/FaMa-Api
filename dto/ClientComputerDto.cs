namespace FaMaApi.Dtos;
public record EnrollClientComputerDto
{
    public string HostName {get; set;} = string.Empty;
    public string IpAddress {get; set;} = string.Empty;
    public string MacAddress {get; set;} = string.Empty;
    public string Uuid {get; set;} = string.Empty;
}

public record UpdateClientComputerDto
{
    public string HostName {get; set;} = string.Empty;
    public string IpAddress {get; set;} = string.Empty;
    public string MacAddress {get; set;} = string.Empty;
}

public record EnrollResponseDto
{
    public int Id {get; set;}
    public string usageCode {get; set;} = string.Empty;
    public DateTime usageCodeExpiration {get; set;} = DateTime.UtcNow;
    public string Message {get; set;} = string.Empty;
}

public record ConfirmEnrollmentDto
{
    public int ClientId {get; set;} = 0;
    public string UsageCode {get; set;} = string.Empty;
}