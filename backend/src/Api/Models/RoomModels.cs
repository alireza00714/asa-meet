namespace Api.Models;

public sealed record JoinRequest(string RoomId, string? DisplayName, string? Passphrase, bool IsHost);

public sealed record JoinDecision(string RequestId, bool Approved);

public sealed record SendChatRequest(string RoomId, string CipherText, string Iv);
public sealed record SendFileRequest(string RoomId, string FileName, string ContentType, string CipherText, string Iv);

public sealed record ChatDeleteEvent(string RoomId, string MessageId);

public sealed record RoomFile(string Id, string FileName, string ContentType, string CipherText, string Iv, DateTimeOffset ExpiresAt);

public sealed class Participant
{
    public required string ConnectionId { get; init; }
    public required string ParticipantId { get; init; }
    public required string DisplayName { get; init; }
    public bool IsHost { get; init; }
    public bool IsMutedByHost { get; set; }
    public DateTimeOffset LastSeenUtc { get; set; }
}

public sealed class WaitingRoomRequest
{
    public required string RequestId { get; init; }
    public required string ConnectionId { get; init; }
    public required string ParticipantId { get; init; }
    public required string DisplayName { get; init; }
    public DateTimeOffset ExpiresAtUtc { get; init; }
}

public sealed class ChatMessage
{
    public required string MessageId { get; init; }
    public required string ParticipantId { get; init; }
    public required string DisplayName { get; init; }
    public required string CipherText { get; init; }
    public required string Iv { get; init; }
    public DateTimeOffset ExpiresAtUtc { get; init; }
}

public sealed class MeetingRoom
{
    public required string RoomId { get; init; }
    public string? PassphraseHash { get; set; }
    public bool IsLocked { get; set; }
    public DateTimeOffset ExpiresAtUtc { get; set; }
    public Dictionary<string, Participant> ParticipantsByConnection { get; } = new(StringComparer.Ordinal);
    public Dictionary<string, WaitingRoomRequest> WaitingRoomByRequestId { get; } = new(StringComparer.Ordinal);
    public Dictionary<string, ChatMessage> ChatMessagesById { get; } = new(StringComparer.Ordinal);
    public Dictionary<string, RoomFile> FilesById { get; } = new(StringComparer.Ordinal);
}
