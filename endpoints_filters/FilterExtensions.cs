namespace FaMaApi.Filters;
public static class FilterExtensions
{
    public static RouteGroupBuilder RequireApiKey(this RouteGroupBuilder group)
    {
        group.AddEndpointFilter<ApiKeyAuthFilter>();
        return group;
    }
}