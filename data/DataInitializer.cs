using Microsoft.AspNetCore.Identity;

public static class DataInitializer
{
    public static async Task SeedRootUserAsync(this WebApplication app)
    {
        using var scope = app.Services.CreateScope();
        var services = scope.ServiceProvider;
        
        // Obtenemos el logger fuera del try para usarlo también en los errores de Identity
        var logger = services.GetRequiredService<ILogger<Program>>();

        try
        {
            var userManager = services.GetRequiredService<UserManager<IdentityUser>>();
            var configuration = services.GetRequiredService<IConfiguration>();

            string rootEmail = "admin@fama.local";
            var rootUser = await userManager.FindByEmailAsync(rootEmail);
            
            if (rootUser == null)
            {
                var user = new IdentityUser
                {
                    UserName = rootEmail,
                    Email = rootEmail,
                    EmailConfirmed = true
                };

                // Lee la contraseña desde configuración o variables de entorno
                string rootPassword = configuration["RootUser:Password"] ?? "AdminPassword123!";

                var result = await userManager.CreateAsync(user, rootPassword);

                if (result.Succeeded)
                {
                    logger.LogInformation("Usuario root ({Email}) creado exitosamente.", rootEmail);
                }
                else
                {
                    // Si Identity rechaza la contraseña (por políticas de complejidad), lo registramos en los logs
                    var errores = string.Join(", ", result.Errors.Select(e => e.Description));
                    logger.LogError("No se pudo crear el usuario root. Errores de Identity: {Errors}", errores);
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Ocurrió un error crítico al sembrar el usuario root.");
        }
    }
}