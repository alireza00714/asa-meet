using Api.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;
using Api.Options;

namespace Api.Services;

public sealed class EphemeralCleanupService : BackgroundService
{
    private readonly RoomStateStore _roomStateStore;
    private readonly IHubContext<MeetingHub> _hubContext;
    private readonly AppOptions _options;
    private readonly ILogger<EphemeralCleanupService> _logger;

    public EphemeralCleanupService(
        RoomStateStore roomStateStore,
        IHubContext<MeetingHub> hubContext,
        IOptions<AppOptions> options,
        ILogger<EphemeralCleanupService> logger)
    {
        _roomStateStore = roomStateStore;
        _hubContext = hubContext;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(_options.CleanupSweepIntervalSeconds));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            var sweep = _roomStateStore.SweepExpired();
            foreach (var deleteEvent in sweep.ChatDeletes)
            {
                await _hubContext.Clients.Group(deleteEvent.RoomId).SendAsync(
                    "ChatDeleted",
                    deleteEvent,
                    stoppingToken);
            }

            if (sweep.ChatDeletes.Count > 0)
            {
                _logger.LogInformation(
                    "Hard-deleted expired data. chat={ChatCount}",
                    sweep.ChatDeletes.Count);
            }
        }
    }
}
