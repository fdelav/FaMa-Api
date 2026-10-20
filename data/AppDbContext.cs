using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;

public class AppDbContext : IdentityDbContext<IdentityUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) {}

    public DbSet<StatusReport> StatusReports => Set<StatusReport>();
    public DbSet<ClientComputer> ClientComputers => Set<ClientComputer>();
    public DbSet<ClientStatistics> ClientStatistics => Set<ClientStatistics>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<UserForm> UserForms => Set<UserForm>();
}