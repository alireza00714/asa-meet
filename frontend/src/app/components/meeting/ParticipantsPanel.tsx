import { motion } from "framer-motion";
import { UserX, VolumeX, Users } from "lucide-react";

type Participant = {
  participantId: string;
  connectionId: string;
  displayName: string;
  isHost: boolean;
};

type ParticipantsPanelProps = Readonly<{
  participants: Participant[];
  onMute: (connectionId: string) => void;
  onKick: (connectionId: string) => void;
}>;

export function ParticipantsPanel({ participants, onMute, onKick }: ParticipantsPanelProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5"
    >
      <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-semibold">
        <Users size={18} />
        Participants
      </h2>
      <ul className="space-y-2">
        {participants.length === 0 ? <li className="text-sm text-slate-400">No active participants.</li> : null}
        {participants.map((p) => (
          <li className="rounded-lg bg-slate-800 p-2.5 text-sm" key={p.participantId}>
            <div className="mb-2 flex items-center justify-between">
              <span>{p.displayName} {p.isHost ? "(host)" : ""}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className="inline-flex items-center justify-center gap-1 rounded-lg bg-zinc-700 px-2 py-2 text-sm font-medium" onClick={() => onMute(p.connectionId)}>
                <VolumeX size={14} />
                Mute
              </button>
              <button className="inline-flex items-center justify-center gap-1 rounded-lg bg-rose-700 px-2 py-2 text-sm font-medium" onClick={() => onKick(p.connectionId)}>
                <UserX size={14} />
                Kick
              </button>
            </div>
          </li>
        ))}
      </ul>
    </motion.article>
  );
}
