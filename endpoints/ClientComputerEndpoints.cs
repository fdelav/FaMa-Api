using Microsoft.EntityFrameworkCore;
using FaMaApi.Dtos;
public static class ClientComputerEndpoints
{
    public static void MapClientComputerEndpoints(this IEndpointRouteBuilder app)
    {
        var clientComputerGroup = app.MapGroup("/clientcomputer");

        clientComputerGroup.MapGet("/", GetClientComputers);
        clientComputerGroup.MapGet("/{id}", GetById);
        clientComputerGroup.MapPost("/enroll", Enroll);
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
        var clientComputer = new ClientComputer
        {
            HostName = dto.HostName,
            IpAddress = dto.IpAddress,
            MacAddress = dto.MacAddress,
            Uuid = dto.Uuid
        };

        db.ClientComputers.Add(clientComputer);
        await db.SaveChangesAsync();
        return Results.Created($"/clientcomputer/{clientComputer.Id}", clientComputer);
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