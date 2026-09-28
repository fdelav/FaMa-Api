using Microsoft.EntityFrameworkCore;
using FaMaApi.Dtos;
using FaMaApi.Filters;

public static class UserFormEndpoint
{
    public static void MapUserFormEndpoint(this IEndpointRouteBuilder app)
    {
        var userGroup = app.MapGroup("/user/userform").RequireApiKey();
        var adminGroup = app.MapGroup("/admin/userform");

        userGroup.MapPost("/", CreateUserForm);
        adminGroup.MapGet("/", GetAllUserForms);
        adminGroup.MapGet("/{id}", GetUserFormById);
        adminGroup.MapDelete("/{id}", DeleteUserForm);
    }

    private static async Task<IResult> CreateUserForm(CreateUserFormDto userFormDto, AppDbContext db)
    {
        var userForm = new UserForm
        {
            Email = userFormDto.Email,
            IdPc = userFormDto.IdPc,
            Location = userFormDto.Location,
            PcCode = userFormDto.PcCode,
            Ticket = userFormDto.Ticket,
            Description = userFormDto.Description,
            CreatedAt = DateTime.UtcNow
        };

        db.UserForms.Add(userForm);
        await db.SaveChangesAsync();
        return Results.Created($"/userform/{userForm.Id}", userForm);
    }
    public static async Task<IResult> GetAllUserForms(AppDbContext db)
    {
        var userForms = await db.UserForms.ToListAsync();
        return Results.Ok(userForms);
    }
    public static async Task<IResult> GetUserFormById(int id, AppDbContext db)
    {
        var userForm = await db.UserForms.FindAsync(id);
        return userForm != null ? Results.Ok(userForm) : Results.NotFound();
    }
    public static async Task<IResult> DeleteUserForm(int id, AppDbContext db)
    {
        var userForm = await db.UserForms.FindAsync(id);
        if (userForm == null)
        {
            return Results.NotFound();
        }

        db.UserForms.Remove(userForm);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }
}