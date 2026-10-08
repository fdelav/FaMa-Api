using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;
using Microsoft.AspNetCore.Identity;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var conectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(conectionString));
builder.Services.AddIdentityApiEndpoints<IdentityUser>().AddEntityFrameworkStores<AppDbContext>();

builder.Services.AddHostedService<EstadisticasWorker>();
builder.Services.AddHostedService<InactiveComputerMonitorWorker>();
builder.Services.AddAuthentication();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}
app.UseAuthentication();

app.MapGroup("/auth").MapIdentityApi<IdentityUser>();

app.UseHttpsRedirection();

app.MapStatusReportEndpoint();
app.MapClientComputerEndpoints();
app.MapClientStatisticsEndpoint();
app.MapNotificationEndpoints();
app.MapUserFormEndpoint();

app.UseDefaultFiles();
app.UseStaticFiles();
app.Run();