import type { EphemeralFile } from "../../../features/files/ephemeralFiles";
import { motion } from "framer-motion";
import { Download, FileUp, Files } from "lucide-react";

type FilesPanelProps = Readonly<{
  files: EphemeralFile[];
  onSendFile: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}>;

export function FilesPanel({ files, onSendFile }: FilesPanelProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5"
    >
      <h2 className="mb-2 inline-flex items-center gap-2 text-lg font-semibold">
        <Files size={18} />
        Ephemeral files
      </h2>
      <p className="mb-3 text-sm text-slate-300">Encrypted in-browser and auto-expired by TTL.</p>
      <form onSubmit={onSendFile} className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          name="fileInput"
          type="file"
          className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-sky-700 file:px-3 file:py-2 file:text-white"
        />
        <button className="inline-flex items-center justify-center gap-1 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold" type="submit">
          <FileUp size={14} />
          Send file
        </button>
      </form>
      <ul className="space-y-2">
        {files.length === 0 ? <li className="text-sm text-slate-400">No shared files yet.</li> : null}
        {files.map((f) => (
          <li key={f.id} className="rounded-lg bg-slate-800 p-2.5 text-sm">
            <a href={f.downloadUrl} download={f.fileName} className="inline-flex items-center gap-1 underline underline-offset-2">
              <Download size={14} />
              {f.fileName}
            </a>
          </li>
        ))}
      </ul>
    </motion.article>
  );
}
