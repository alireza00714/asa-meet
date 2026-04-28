import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr";

type ParticipantJoined = {
  participantId: string;
  connectionId: string;
  displayName: string;
  isHost: boolean;
};

export type MeetingEvents = {
  onParticipantJoined: (participant: ParticipantJoined) => void;
  onParticipantLeft: (participantId: string) => void;
  onChatReceived: (chat: {
    messageId: string;
    displayName: string;
    cipherText: string;
    iv: string;
    expiresAtUtc: string;
  }) => void;
  onChatDeleted: (payload: { messageId: string }) => void;
  onJoinPending: (requestId: string) => void;
  onWaitingRoomRequested: (request: { requestId: string; displayName: string }) => void;
  onFileReceived: (file: {
    id: string;
    fileName: string;
    contentType: string;
    cipherText: string;
    iv: string;
    expiresAt: string;
  }) => void;
};

export class PeerManager {
  private readonly connection: HubConnection;

  constructor(private readonly events: MeetingEvents) {
    this.connection = new HubConnectionBuilder()
      .withUrl(`${import.meta.env.VITE_API_URL ?? "http://localhost:8080"}/hubs/meeting`)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    this.connection.on("ParticipantJoined", this.events.onParticipantJoined);
    this.connection.on("ParticipantLeft", this.events.onParticipantLeft);
    this.connection.on("ChatReceived", this.events.onChatReceived);
    this.connection.on("ChatDeleted", this.events.onChatDeleted);
    this.connection.on("JoinPending", this.events.onJoinPending);
    this.connection.on("WaitingRoomRequested", this.events.onWaitingRoomRequested);
    this.connection.on("FileReceived", this.events.onFileReceived);
  }

  async start(): Promise<void> {
    if (this.connection.state === HubConnectionState.Disconnected) {
      await this.connection.start();
    }
  }

  async joinRoom(roomId: string, displayName: string, passphrase: string, isHost: boolean): Promise<void> {
    await this.connection.invoke("JoinRoom", { roomId, displayName, passphrase, isHost });
  }

  async sendChat(roomId: string, cipherText: string, iv: string): Promise<void> {
    await this.connection.invoke("SendEphemeralChat", { roomId, cipherText, iv });
  }

  async setRoomLock(roomId: string, isLocked: boolean, passphrase: string): Promise<void> {
    await this.connection.invoke("SetRoomLock", roomId, isLocked, passphrase);
  }

  async decideWaiting(roomId: string, requestId: string, approved: boolean): Promise<void> {
    await this.connection.invoke("DecideWaitingRequest", roomId, { requestId, approved });
  }

  async moderate(roomId: string, targetConnectionId: string, action: "mute" | "kick"): Promise<void> {
    await this.connection.invoke("ModerateParticipant", roomId, targetConnectionId, action);
  }

  async sendFile(
    roomId: string,
    fileName: string,
    contentType: string,
    cipherText: string,
    iv: string
  ): Promise<void> {
    await this.connection.invoke("SendEphemeralFile", {
      roomId,
      fileName,
      contentType,
      cipherText,
      iv,
    });
  }
}
