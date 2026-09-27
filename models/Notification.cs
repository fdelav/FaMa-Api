public class Notification
{
    public int Id { get; set; }
    public int PcId { get; set; }
    public string Message { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public int IsRead { get; set; } = 0; // 0: Unread, 1: Read
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}