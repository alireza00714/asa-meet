import type { WaitingRoomRequest } from "../../../features/moderation/moderationStore";
import { motion } from "framer-motion";
import { Lock, Unlock, Shield } from "lucide-react";

type RoomControlsPanelProps = Readonly<{
  waitingRoom: WaitingRoomRequest[];
  onLockRoom: () => void;
  onUnlockRoom: () => void;
  onApproveWaiting: (requestId: string) => void;
  onRejectWaiting: (requestId: string) => void;
}>;

export function RoomControlsPanel({
  waitingRoom,
  onLockRoom,
  onUnlockRoom,
  onApproveWaiting,
  onRejectWaiting,
}: RoomControlsPanelProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5"
    >
      <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-semibold">
        <Shield size={18} />
        Room controls
      </h2>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button className="inline-flex items-center justify-center gap-1 rounded-lg bg-amber-600 px-3 py-2.5 text-sm font-semibold" onClick={onLockRoom}>
          <Lock size={14} />
          Lock room
        </button>
        <button className="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-700 px-3 py-2.5 text-sm font-semibold" onClick={onUnlockRoom}>
          <Unlock size={14} />
          Unlock room
        </button>
      </div>
      <h3 className="mb-2 text-sm font-semibold text-slate-200">Waiting room requests</h3>
      <div className="space-y-2">
        {waitingRoom.length === 0 ? <p className="text-sm text-slate-400">No pending requests.</p> : null}
        {waitingRoom.map((req) => (
          <div key={req.requestId} className="rounded-lg bg-slate-800 p-2.5 text-sm">
            <p className="mb-2">{req.displayName}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="rounded-lg bg-emerald-600 px-2 py-2 text-sm font-medium"
                onClick={() => onApproveWaiting(req.requestId)}
              >
                Approve
              </button>
              <button
                className="rounded-lg bg-rose-600 px-2 py-2 text-sm font-medium"
                onClick={() => onRejectWaiting(req.requestId)}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.article>
  );
}
