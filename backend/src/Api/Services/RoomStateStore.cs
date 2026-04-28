using System.Security.Cryptography;
using System.Text;
using Api.Models;
using Api.Options;
using Microsoft.Extensions.Options;

namespace Api.Services;

public sealed record SweepResult(List<ChatDeleteEvent> ChatDeletes);

public sealed class RoomStateStore
{
    private readonly Dictionary<string, MeetingRoom> _rooms = new(StringComparer.Ordinal);
    private readonly Lock _lock = new();
    private readonly AppOptions _options;

    public RoomStateStore(IOptions<AppOptions> options)
    {
        _options = options.Value;
    }

    public MeetingRoom UpsertRoom(string roomId)
    {
        lock (_lock)
        {
            if (!_rooms.TryGetValue(roomId, out var room))
            {
                room = new MeetingRoom
                {
                    RoomId = roomId,
                    ExpiresAtUtc = DateTimeOffset.UtcNow.AddSeconds(_options.RoomIdleTtlSeconds)
                };
                _rooms.Add(roomId, room);
            }

            ExtendRoomTtl(room);
            return room;
        }
    }

    public MeetingRoom? GetRoom(string roomId)
    {
        lock (_lock)
        {
            if (!_rooms.TryGetValue(roomId, out var room))
            {
                return null;
            }

            ExtendRoomTtl(room);
            return room;
        }
    }

    public IReadOnlyCollection<MeetingRoom> SnapshotRooms()
    {
        lock (_lock)
        {
            return _rooms.Values.ToArray();
        }
    }

    public bool VerifyPassphrase(MeetingRoom room, string? passphrase)
    {
        if (string.IsNullOrWhiteSpace(room.PassphraseHash))
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(passphrase))
        {
            return false;
        }

        return room.PassphraseHash.Equals(Hash(passphrase), StringComparison.Ordinal);
    }

    public void SetRoomPassphrase(MeetingRoom room, string passphrase)
    {
        room.PassphraseHash = Hash(passphrase);
        ExtendRoomTtl(room);
    }

    public string AddParticipant(MeetingRoom room, string connectionId, string displayName, bool isHost)
    {
        var participantId = Guid.NewGuid().ToString("N");
        room.ParticipantsByConnection[connectionId] = new Participant
        {
            ConnectionId = connectionId,
            ParticipantId = participantId,
            DisplayName = displayName,
            IsHost = isHost,
            LastSeenUtc = DateTimeOffset.UtcNow
        };
        ExtendRoomTtl(room);
        return participantId;
    }

    public Participant? RemoveParticipant(MeetingRoom room, string connectionId)
    {
        if (!room.ParticipantsByConnection.Remove(connectionId, out var participant))
        {
            return null;
        }

        ExtendRoomTtl(room);
        return participant;
    }

    public ChatMessage AddChat(MeetingRoom room, string participantId, string displayName, string cipherText, string iv)
    {
        var chat = new ChatMessage
        {
            MessageId = Guid.NewGuid().ToString("N"),
            ParticipantId = participantId,
            DisplayName = displayName,
            CipherText = cipherText,
            Iv = iv,
            ExpiresAtUtc = DateTimeOffset.UtcNow.AddSeconds(_options.ChatMessageTtlSeconds)
        };
        room.ChatMessagesById[chat.MessageId] = chat;
        ExtendRoomTtl(room);
        return chat;
    }

    public WaitingRoomRequest AddWaitingRoomRequest(MeetingRoom room, string connectionId, string participantId, string displayName)
    {
        var request = new WaitingRoomRequest
        {
            RequestId = Guid.NewGuid().ToString("N"),
            ConnectionId = connectionId,
            ParticipantId = participantId,
            DisplayName = displayName,
            ExpiresAtUtc = DateTimeOffset.UtcNow.AddSeconds(_options.WaitingRoomRequestTtlSeconds)
        };
        room.WaitingRoomByRequestId[request.RequestId] = request;
        ExtendRoomTtl(room);
        return request;
    }

    public RoomFile AddTempFile(MeetingRoom room, string fileName, string contentType, string cipherText, string iv)
    {
        var file = new RoomFile(
            Guid.NewGuid().ToString("N"),
            fileName,
            contentType,
            cipherText,
            iv,
            DateTimeOffset.UtcNow.AddSeconds(_options.TempFileTtlSeconds));
        room.FilesById[file.Id] = file;
        ExtendRoomTtl(room);
        return file;
    }

    public SweepResult SweepExpired()
    {
        var now = DateTimeOffset.UtcNow;
        var deletes = new List<ChatDeleteEvent>();

        lock (_lock)
        {
            var expiredRooms = _rooms.Values.Where(r => r.ExpiresAtUtc <= now).Select(r => r.RoomId).ToArray();
            foreach (var roomId in expiredRooms)
            {
                _rooms.Remove(roomId);
            }

            foreach (var room in _rooms.Values)
            {
                var expiredRequests = room.WaitingRoomByRequestId.Values.Where(x => x.ExpiresAtUtc <= now).Select(x => x.RequestId).ToArray();
                foreach (var id in expiredRequests)
                {
                    room.WaitingRoomByRequestId.Remove(id);
                }

                var expiredMessages = room.ChatMessagesById.Values.Where(x => x.ExpiresAtUtc <= now).Select(x => x.MessageId).ToArray();
                foreach (var id in expiredMessages)
                {
                    room.ChatMessagesById.Remove(id);
                    deletes.Add(new ChatDeleteEvent(room.RoomId, id));
                }

                var expiredFiles = room.FilesById.Values.Where(x => x.ExpiresAt <= now).Select(x => x.Id).ToArray();
                foreach (var id in expiredFiles)
                {
                    room.FilesById.Remove(id);
                }
            }
        }

        return new SweepResult(deletes);
    }

    private void ExtendRoomTtl(MeetingRoom room)
    {
        room.ExpiresAtUtc = DateTimeOffset.UtcNow.AddSeconds(_options.RoomIdleTtlSeconds);
    }

    private static string Hash(string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(bytes);
    }
}
