public class UserForm
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public int IdPc { get; set; }
    public string Location { get; set; } = string.Empty;
    public string PcCode { get; set; } = string.Empty;
    public string Ticket { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.Now;
}