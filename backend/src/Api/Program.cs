using System.Threading.RateLimiting;
using Api.Hubs;
using Api.Options;
using Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<AppOptions>(builder.Configuration.GetSection(AppOptions.SectionName));
builder.Services.AddSingleton<RoomStateStore>();
builder.Services.AddHostedService<EphemeralCleanupService>();
builder.Services.AddSignalR();
builder.Services.AddResponseCompression();
builder.Services.AddHealthChecks();
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("signaling", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 120,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 20
            }));
});
builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
    {
        var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? ["http://localhost:5173"];
        policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
    });
});

var app = builder.Build();

app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
    context.Response.Headers.Append("Content-Security-Policy", "default-src 'self'; connect-src 'self' wss: https:; media-src 'self' blob:;");
    await next();
});

app.UseHttpsRedirection();
app.UseResponseCompression();
app.UseCors("frontend");
app.UseRateLimiter();

app.MapGet("/", () => Results.Ok(new { service = "asa-meet-net-api", status = "ok" }));
app.MapHealthChecks("/healthz");
app.MapHub<MeetingHub>("/hubs/meeting");

app.Run();
