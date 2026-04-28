import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ChatPanel } from "../components/meeting/ChatPanel";
import { FilesPanel } from "../components/meeting/FilesPanel";
import { JoinSettingsForm } from "../components/meeting/JoinSettingsForm";
import { MeetingHeader } from "../components/meeting/MeetingHeader";
import { MobileBottomNav } from "../components/meeting/MobileBottomNav";
import { ParticipantsPanel } from "../components/meeting/ParticipantsPanel";
import { RoomControlsPanel } from "../components/meeting/RoomControlsPanel";
import { hardDeleteMessage, type EphemeralChatMessage, upsertMessage } from "../../features/chat/ephemeralChatStore";
import { bytesToArrayBuffer, decryptBytes, decryptText, deriveRoomKey, encryptBytes, encryptText, getKeyFingerprint } from "../../features/crypto/e2ee";
import { clearExpiredFiles, type EphemeralFile } from "../../features/files/ephemeralFiles";
import { addWaitingRequest, initialModerationState, removeWaitingRequest } from "../../features/moderation/moderationStore";
import { PeerManager } from "../../features/webrtc/peerManager";

export function MeetingPage() {
  const { roomId: routeRoomId } = useParams();
  const [roomId, setRoomId] = useState(routeRoomId ?? "demo-room");
  const [displayName, setDisplayName] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [messages, setMessages] = useState<EphemeralChatMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [files, setFiles] = useState<EphemeralFile[]>([]);
  const [participants, setParticipants] = useState<{ participantId: string; connectionId: string; displayName: string; isHost: boolean }[]>([]);
  const [joinStatus, setJoinStatus] = useState("Not connected");
  const [modState, setModState] = useState(initialModerationState);
  const [e2eeReady, setE2eeReady] = useState(false);
  const [e2eeError, setE2eeError] = useState<string | null>(null);
  const [keyFingerprint, setKeyFingerprint] = useState<string>("");
  const [activeMobileTab, setActiveMobileTab] = useState<"chat" | "controls" | "people" | "files">("chat");
  const peerManagerRef = useRef<PeerManager | null>(null);
  const roomKeyRef = useRef<CryptoKey | null>(null);
  const fileUrlsRef = useRef<Set<string>>(new Set());

  const peerManager = useMemo(
    () =>
      new PeerManager({
        onParticipantJoined: (participant) =>
          setParticipants((prev) => [...prev.filter((x) => x.participantId !== participant.participantId), participant]),
        onParticipantLeft: (participantId) =>
          setParticipants((prev) => prev.filter((x) => x.participantId !== participantId)),
        onChatReceived: (chat) => {
          const key = roomKeyRef.current;
          if (!key) {
            return;
          }

          void decryptText(key, { cipherText: chat.cipherText, iv: chat.iv })
            .then((plainMessage) => {
              setMessages((prev) =>
                upsertMessage(prev, {
                  messageId: chat.messageId,
                  displayName: chat.displayName,
                  message: plainMessage,
                  expiresAtUtc: chat.expiresAtUtc,
                })
              );
            })
            .catch(() => {
              setE2eeError("Failed to decrypt a message. Check passphrase consistency.");
            });
        },
        onChatDeleted: ({ messageId }) => setMessages((prev) => hardDeleteMessage(prev, messageId)),
        onJoinPending: () => setJoinStatus("Waiting room pending approval"),
        onWaitingRoomRequested: (request) => setModState((prev) => addWaitingRequest(prev, request)),
        onFileReceived: (file) => {
          const key = roomKeyRef.current;
          if (!key) {
            return;
          }

          void decryptBytes(key, { cipherText: file.cipherText, iv: file.iv })
            .then((bytes) => {
              const blob = new Blob([bytesToArrayBuffer(bytes)], { type: file.contentType || "application/octet-stream" });
              const url = URL.createObjectURL(blob);
              fileUrlsRef.current.add(url);
              setFiles((prev) => [
                ...prev.filter((x) => x.id !== file.id),
                {
                  id: file.id,
                  fileName: file.fileName,
                  contentType: file.contentType,
                  downloadUrl: url,
                  expiresAtUtc: file.expiresAt,
                },
              ]);
            })
            .catch(() => {
              setE2eeError("Failed to decrypt a file payload.");
            });
        },
      }),
    []
  );

  useEffect(() => {
    peerManagerRef.current = peerManager;
    void peerManager.start();
  }, [peerManager]);

  useEffect(() => {
    const timer = setInterval(() => {
      setMessages((prev) =>
        prev.filter((m) => new Date(m.expiresAtUtc).getTime() > Date.now())
      );
      setFiles((prev) => {
        const next = clearExpiredFiles(prev);
        const removed = prev.filter((x) => !next.some((n) => n.id === x.id));
        for (const file of removed) {
          URL.revokeObjectURL(file.downloadUrl);
          fileUrlsRef.current.delete(file.downloadUrl);
        }
        return next;
      });
    }, 1000);
    return () => {
      clearInterval(timer);
      for (const url of fileUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      fileUrlsRef.current.clear();
    };
  }, []);

  const onJoin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!passphrase.trim()) {
      setE2eeError("Passphrase is required for E2EE.");
      return;
    }

    roomKeyRef.current = await deriveRoomKey(passphrase.trim(), roomId);
    setKeyFingerprint(await getKeyFingerprint(passphrase.trim(), roomId));
    await peerManager.joinRoom(roomId, displayName, passphrase, isHost);
    setE2eeReady(true);
    setE2eeError(null);
    setJoinStatus("Joined");
  };

  const onSendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!messageDraft.trim()) return;
    const key = roomKeyRef.current;
    if (!key) {
      setE2eeError("Join with passphrase first to initialize encryption.");
      return;
    }

    const encrypted = await encryptText(key, messageDraft);
    await peerManager.sendChat(roomId, encrypted.cipherText, encrypted.iv);
    setMessageDraft("");
  };

  const onSendFile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const key = roomKeyRef.current;
    if (!key) {
      setE2eeError("Join with passphrase first to initialize encryption.");
      return;
    }

    const form = event.currentTarget;
    const input = form.elements.namedItem("fileInput") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }

    const plainBytes = new Uint8Array(await file.arrayBuffer());
    const encrypted = await encryptBytes(key, plainBytes);
    await peerManager.sendFile(roomId, file.name, file.type || "application/octet-stream", encrypted.cipherText, encrypted.iv);
    form.reset();
  };

  const jumpToSection = (tab: "chat" | "controls" | "people" | "files") => {
    setActiveMobileTab(tab);
    const section = document.getElementById(`section-${tab}`);
    if (!section) {
      return;
    }

    section.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 px-3 py-4 pb-24 text-slate-100 sm:px-6 sm:py-6 lg:pb-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <MeetingHeader
          roomId={roomId}
          joinStatus={joinStatus}
          e2eeReady={e2eeReady}
          keyFingerprint={keyFingerprint}
          e2eeError={e2eeError}
        />

        <JoinSettingsForm
          roomId={roomId}
          displayName={displayName}
          passphrase={passphrase}
          isHost={isHost}
          onRoomIdChange={setRoomId}
          onDisplayNameChange={setDisplayName}
          onPassphraseChange={setPassphrase}
          onHostChange={setIsHost}
          onSubmit={onJoin}
        />

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div id="section-chat">
            <ChatPanel
              messageDraft={messageDraft}
              messages={messages}
              onMessageDraftChange={setMessageDraft}
              onSendMessage={onSendMessage}
            />
          </div>

          <div id="section-controls">
            <RoomControlsPanel
              waitingRoom={modState.waitingRoom}
              onLockRoom={() => void peerManager.setRoomLock(roomId, true, passphrase)}
              onUnlockRoom={() => void peerManager.setRoomLock(roomId, false, "")}
              onApproveWaiting={(requestId) => {
                void peerManager.decideWaiting(roomId, requestId, true);
                setModState((prev) => removeWaitingRequest(prev, requestId));
              }}
              onRejectWaiting={(requestId) => {
                void peerManager.decideWaiting(roomId, requestId, false);
                setModState((prev) => removeWaitingRequest(prev, requestId));
              }}
            />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div id="section-people">
            <ParticipantsPanel
              participants={participants}
              onMute={(connectionId) => void peerManager.moderate(roomId, connectionId, "mute")}
              onKick={(connectionId) => void peerManager.moderate(roomId, connectionId, "kick")}
            />
          </div>

          <div id="section-files">
            <FilesPanel files={files} onSendFile={onSendFile} />
          </div>
        </section>
      </div>
      <MobileBottomNav activeTab={activeMobileTab} onSelectTab={jumpToSection} />
    </main>
  );
}
