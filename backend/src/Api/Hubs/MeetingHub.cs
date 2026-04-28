using Api.Models;
using Api.Services;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.SignalR;

namespace Api.Hubs;

[EnableRateLimiting("signaling")]
public sealed class MeetingHub : Hub
{
    private readonly RoomStateStore _roomStateStore;
    private readonly ILogger<MeetingHub> _logger;

    public MeetingHub(RoomStateStore roomStateStore, ILogger<MeetingHub> logger)
    {
        _roomStateStore = roomStateStore;
        _logger = logger;
    }

    public async Task JoinRoom(JoinRequest request)
    {
        var room = _roomStateStore.UpsertRoom(request.RoomId);
        var displayName = string.IsNullOrWhiteSpace(request.DisplayName) ? $"guest-{Random.Shared.Next(1000, 9999)}" : request.DisplayName.Trim();
        var participantId = Guid.NewGuid().ToString("N");

        if (room.IsLocked && !request.IsHost)
        {
            var waitingRequest = _roomStateStore.AddWaitingRoomRequest(room, Context.ConnectionId, participantId, displayName);
            await Clients.Group(request.RoomId).SendAsync("WaitingRoomRequested", waitingRequest);
            await Clients.Caller.SendAsync("JoinPending", waitingRequest.RequestId);
            return;
        }

        if (!_roomStateStore.VerifyPassphrase(room, request.Passphrase))
        {
            throw new HubException("Invalid passphrase.");
        }

        participantId = _roomStateStore.AddParticipant(room, Context.ConnectionId, displayName, request.IsHost);
        await Groups.AddToGroupAsync(Context.ConnectionId, request.RoomId);
        await Clients.Group(request.RoomId).SendAsync("ParticipantJoined", new { participantId, connectionId = Context.ConnectionId, displayName, isHost = request.IsHost });
    }

    public Task RelayOffer(string roomId, string toConnectionId, string sdp) =>
        Clients.Client(toConnectionId).SendAsync("ReceiveOffer", Context.ConnectionId, sdp);

    public Task RelayAnswer(string toConnectionId, string sdp) =>
        Clients.Client(toConnectionId).SendAsync("ReceiveAnswer", Context.ConnectionId, sdp);

    public Task RelayIceCandidate(string toConnectionId, string candidateJson) =>
        Clients.Client(toConnectionId).SendAsync("ReceiveIceCandidate", Context.ConnectionId, candidateJson);

    public async Task SendEphemeralChat(SendChatRequest request)
    {
        var room = _roomStateStore.GetRoom(request.RoomId) ?? throw new HubException("Room not found.");
        if (!room.ParticipantsByConnection.TryGetValue(Context.ConnectionId, out var participant))
        {
            throw new HubException("Join room first.");
        }

        if (string.IsNullOrWhiteSpace(request.CipherText) || string.IsNullOrWhiteSpace(request.Iv))
        {
            throw new HubException("Encrypted payload is required.");
        }

        var chat = _roomStateStore.AddChat(room, participant.ParticipantId, participant.DisplayName, request.CipherText.Trim(), request.Iv.Trim());
        await Clients.Group(request.RoomId).SendAsync("ChatReceived", new
        {
            chat.MessageId,
            chat.ParticipantId,
            chat.DisplayName,
            chat.CipherText,
            chat.Iv,
            chat.ExpiresAtUtc
        });
    }

    public async Task SendEphemeralFile(SendFileRequest request)
    {
        var room = _roomStateStore.GetRoom(request.RoomId) ?? throw new HubException("Room not found.");
        if (!room.ParticipantsByConnection.TryGetValue(Context.ConnectionId, out var participant))
        {
            throw new HubException("Join room first.");
        }

        if (string.IsNullOrWhiteSpace(request.CipherText) || string.IsNullOrWhiteSpace(request.Iv))
        {
            throw new HubException("Encrypted payload is required.");
        }

        var file = _roomStateStore.AddTempFile(
            room,
            request.FileName.Trim(),
            request.ContentType.Trim(),
            request.CipherText.Trim(),
            request.Iv.Trim());

        await Clients.Group(request.RoomId).SendAsync("FileReceived", new
        {
            file.Id,
            file.FileName,
            file.ContentType,
            file.CipherText,
            file.Iv,
            file.ExpiresAt
        });
    }

    public async Task SetRoomLock(string roomId, bool isLocked, string? passphrase)
    {
        var room = _roomStateStore.GetRoom(roomId) ?? throw new HubException("Room not found.");
        EnsureHost(room);
        room.IsLocked = isLocked;
        if (!string.IsNullOrWhiteSpace(passphrase))
        {
            _roomStateStore.SetRoomPassphrase(room, passphrase);
        }
        await Clients.Group(roomId).SendAsync("RoomLockChanged", new { roomId, isLocked });
    }

    public async Task DecideWaitingRequest(string roomId, JoinDecision decision)
    {
        var room = _roomStateStore.GetRoom(roomId) ?? throw new HubException("Room not found.");
        EnsureHost(room);
        if (!room.WaitingRoomByRequestId.Remove(decision.RequestId, out var request))
        {
            return;
        }

        await Clients.Client(request.ConnectionId).SendAsync("JoinDecision", decision.Approved);
        if (decision.Approved)
        {
            var newParticipantId = _roomStateStore.AddParticipant(room, request.ConnectionId, request.DisplayName, false);
            await Groups.AddToGroupAsync(request.ConnectionId, roomId);
            await Clients.Group(roomId).SendAsync("ParticipantJoined", new { participantId = newParticipantId, connectionId = request.ConnectionId, displayName = request.DisplayName, isHost = false });
        }
    }

    public async Task ModerateParticipant(string roomId, string targetConnectionId, string action)
    {
        var room = _roomStateStore.GetRoom(roomId) ?? throw new HubException("Room not found.");
        EnsureHost(room);

        if (!room.ParticipantsByConnection.TryGetValue(targetConnectionId, out var participant))
        {
            return;
        }

        if (action.Equals("mute", StringComparison.OrdinalIgnoreCase))
        {
            participant.IsMutedByHost = true;
            await Clients.Client(targetConnectionId).SendAsync("ForceMute");
            return;
        }

        if (action.Equals("kick", StringComparison.OrdinalIgnoreCase))
        {
            room.ParticipantsByConnection.Remove(targetConnectionId);
            await Groups.RemoveFromGroupAsync(targetConnectionId, roomId);
            await Clients.Client(targetConnectionId).SendAsync("Kicked");
            await Clients.Group(roomId).SendAsync("ParticipantLeft", participant.ParticipantId);
        }
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        foreach (var room in _roomStateStore.SnapshotRooms())
        {
            var removed = _roomStateStore.RemoveParticipant(room, Context.ConnectionId);
            if (removed is not null)
            {
                await Clients.Group(room.RoomId).SendAsync("ParticipantLeft", removed.ParticipantId);
                _logger.LogInformation("Participant {ParticipantId} disconnected.", removed.ParticipantId);
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    private void EnsureHost(MeetingRoom room)
    {
        if (!room.ParticipantsByConnection.TryGetValue(Context.ConnectionId, out var participant) || !participant.IsHost)
        {
            throw new HubException("Host privileges required.");
        }
    }
}
