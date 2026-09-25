using Microsoft.EntityFrameworkCore;

namespace FaMaApi.Filters;

public class ApiKeyAuthFilter : IEndpointFilter
{
    private readonly AppDbContext _db;
    private readonly IHostEnvironment _env;

    // Inyección de dependencias estándar en el constructor
    public ApiKeyAuthFilter(AppDbContext db, IHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var httpContext = context.HttpContext;

        if (_env.IsDevelopment() || _env.IsEnvironment("Testing"))
        {
            if (!httpContext.Request.Headers.ContainsKey("X-Report-Api-Key"))
            {
                httpContext.Items["ClientComputerId"] = 1;
                return await next(context);
            }
        }

        if (!httpContext.Request.Headers.TryGetValue("X-Report-Api-Key", out var apiKeyHeaderValues))
        {
            return Results.Json(new { message = "Falta el encabezado X-Report-Api-Key" }, statusCode: 401);
        }

        string apiKeyInput = apiKeyHeaderValues.ToString();

        if (!Guid.TryParse(apiKeyInput, out Guid apiKeyGuid))
        {
            return Results.Json(new { message = "Formato de API Key inválido" }, statusCode: 401);
        }


        var computerId = await _db.ClientComputers
            .Where(c => c.ReportApiKey == apiKeyGuid)
            .Select(c => (int?)c.Id)
            .FirstOrDefaultAsync<int?>();

        if (computerId == null)
        {
            return Results.Json(new { message = "API Key no registrada o no válida" }, statusCode: 401);
        }

        httpContext.Items["ClientComputerId"] = computerId.Value;

        return await next(context);
    }
}