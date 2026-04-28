namespace Api.Options;

public sealed class AppOptions
{
    public const string SectionName = "App";

    public int RoomIdleTtlSeconds { get; init; } = 1800;
    public int ChatMessageTtlSeconds { get; init; } = 45;
    public int WaitingRoomRequestTtlSeconds { get; init; } = 300;
    public int TempFileTtlSeconds { get; init; } = 600;
    public int CleanupSweepIntervalSeconds { get; init; } = 5;
}
