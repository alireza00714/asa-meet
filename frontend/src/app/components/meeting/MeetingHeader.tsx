import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Fingerprint, Lock, ShieldCheck } from "lucide-react";

type MeetingHeaderProps = Readonly<{
  roomId: string;
  joinStatus: string;
  e2eeReady: boolean;
  keyFingerprint: string;
  e2eeError: string | null;
}>;

export function MeetingHeader({
  roomId,
  joinStatus,
  e2eeReady,
  keyFingerprint,
  e2eeError,
}: MeetingHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg backdrop-blur sm:p-5"
    >
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-indigo-300 hover:underline">
        <ArrowLeft size={16} />
        Back to home
      </Link>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Meeting Room</h1>
          <p className="mt-1 text-sm text-slate-300">Room ID: {roomId}</p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-indigo-600/20 px-3 py-1 text-xs font-medium text-indigo-300">
          <ShieldCheck size={14} className="mr-1" />
          {joinStatus}
        </span>
      </div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <p className="inline-flex items-center rounded-lg bg-slate-800/70 px-3 py-2 text-emerald-300">
          <Lock size={14} className="mr-1.5" />
          E2EE: {e2eeReady ? "Enabled" : "Disabled"}
        </p>
        <p className="inline-flex items-center rounded-lg bg-slate-800/70 px-3 py-2 text-sky-300">
          <Fingerprint size={14} className="mr-1.5" />
          Fingerprint: {e2eeReady ? keyFingerprint : "Join to generate"}
        </p>
      </div>
      {e2eeError ? <p className="mt-2 text-sm text-rose-300">{e2eeError}</p> : null}
    </motion.header>
  );
}
