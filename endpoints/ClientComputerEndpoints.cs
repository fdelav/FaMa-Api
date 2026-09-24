using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using FaMaApi.Dtos;
public static class ClientComputerEndpoints
{
    public static void MapClientComputerEndpoints(this IEndpointRouteBuilder app)
    {
        var clientComputerGroup = app.MapGroup("/clientcomputer");

        clientComputerGroup.MapGet("/", GetClientComputers);
        clientComputerGroup.MapGet("/{id}", GetById);
        clientComputerGroup.MapPost("/enroll", Enroll);
        clientComputerGroup.MapPost("/confirm_enrollment", ConfirmEnrollment);
        clientComputerGroup.MapPut("/{id}", Update);
        clientComputerGroup.MapDelete("/{id}", Delete);
    }

    private static async Task<IResult> GetClientComputers(AppDbContext db)
    {
        var clientComputers = await db.ClientComputers.ToListAsync();
        return Results.Ok(clientComputers);
    }

    private static async Task<IResult> GetById(int id, AppDbContext db)
    {
        var clientComputer = await db.ClientComputers.FindAsync(id);
        return clientComputer != null ? Results.Ok(clientComputer) : Results.NotFound();
    }

    private static async Task<IResult> Enroll(EnrollClientComputerDto dto, AppDbContext db)
    {
        var clientComputer = await db.ClientComputers.FirstOrDefaultAsync(c => c.Uuid == dto.Uuid);

        var usageCode = RandomNumberGenerator.GetInt32(100000, 999999).ToString();
        var codeExpiration = DateTime.UtcNow.AddMinutes(5);


        if (clientComputer == null)
        {
            clientComputer = new ClientComputer
            {
                HostName = dto.HostName,
                IpAddress = dto.IpAddress,
                MacAddress = dto.MacAddress,
                Uuid = dto.Uuid,
                Status = 0,
                usageCode = usageCode,
                usageCodeExpiration = codeExpiration,
                LastEnrollment = DateTime.UtcNow

            };
            db.ClientComputers.Add(clientComputer);
        }
        else
        {
            clientComputer.HostName = dto.HostName;
            clientComputer.IpAddress = dto.IpAddress;
            clientComputer.MacAddress = dto.MacAddress;
            clientComputer.Status = 0;
            clientComputer.usageCode = usageCode;
            clientComputer.usageCodeExpiration = codeExpiration;
            clientComputer.LastEnrollment = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();

        var result = new EnrollResponseDto
        {
            Id = clientComputer.Id,
            usageCode = usageCode,
            LastStatusReport = clientComputer.LastStatusReport,
            Message = $"Client computer enrolled successfully. Usage code: {usageCode}. It will expire at {codeExpiration} UTC."
        };

        
        
        return Results.Created($"/clientcomputer/{clientComputer.Id}", result);
    }

    private static async Task<IResult> ConfirmEnrollment(ConfirmEnrollmentDto dto, AppDbContext db)
    {
        var clientComputer = await db.ClientComputers.FirstOrDefaultAsync(c => c.usageCode == dto.UsageCode && c.Id == dto.ClientId);

        if (clientComputer == null)
        {
            return Results.NotFound("Invalid usage code or client ID.");
        }
        if (clientComputer.usageCodeExpiration < DateTime.UtcNow)
        {
            clientComputer.usageCode = null;
            clientComputer.usageCodeExpiration = null;
            await db.SaveChangesAsync();

            return Results.BadRequest("The usage code has expired. Please initiate enrollment again.");
        }

        clientComputer.usageCode = null;
        clientComputer.usageCodeExpiration = null;
        clientComputer.Status = 1; // Set status to active
        clientComputer.LastEnrollment = DateTime.UtcNow;
        clientComputer.ReportApiKey = Guid.NewGuid(); // Generate a new API key
        await db.SaveChangesAsync();

        return Results.Ok(new { Message = "Enrollment confirmed successfully.", ApiKey = clientComputer.ReportApiKey });
    }

    private static async Task<IResult> Update(int id, UpdateClientComputerDto dto, AppDbContext db)
    {
        var existingClientComputer = await db.ClientComputers.FindAsync(id);
        if (existingClientComputer == null)
            return Results.NotFound();

        existingClientComputer.HostName = dto.HostName;
        existingClientComputer.IpAddress = dto.IpAddress;
        existingClientComputer.MacAddress = dto.MacAddress;

        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    private static async Task<IResult> Delete(int id, AppDbContext db)
    {
        var clientComputer = await db.ClientComputers.FindAsync(id);
        if (clientComputer == null)
            return Results.NotFound();

        db.ClientComputers.Remove(clientComputer);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }
}