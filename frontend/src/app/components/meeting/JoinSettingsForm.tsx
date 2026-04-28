type JoinSettingsFormProps = Readonly<{
  roomId: string;
  displayName: string;
  passphrase: string;
  isHost: boolean;
  onRoomIdChange: (value: string) => void;
  onDisplayNameChange: (value: string) => void;
  onPassphraseChange: (value: string) => void;
  onHostChange: (value: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}>;

export function JoinSettingsForm(props: JoinSettingsFormProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
      <h2 className="mb-3 text-lg font-semibold">Join settings</h2>
      <form className="grid grid-cols-1 gap-2 md:grid-cols-4" onSubmit={props.onSubmit}>
        <input
          className="rounded-lg bg-slate-800 px-3 py-2.5 text-sm"
          value={props.roomId}
          onChange={(e) => props.onRoomIdChange(e.target.value)}
          placeholder="Room ID"
        />
        <input
          className="rounded-lg bg-slate-800 px-3 py-2.5 text-sm"
          value={props.displayName}
          onChange={(e) => props.onDisplayNameChange(e.target.value)}
          placeholder="Display name"
        />
        <input
          className="rounded-lg bg-slate-800 px-3 py-2.5 text-sm"
          value={props.passphrase}
          onChange={(e) => props.onPassphraseChange(e.target.value)}
          placeholder="Passphrase"
        />
        <div className="flex items-center gap-2">
          <label className="flex flex-1 items-center gap-2 rounded-lg bg-slate-800 px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={props.isHost}
              onChange={(e) => props.onHostChange(e.target.checked)}
            />
            Join as host
          </label>
          <button
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold hover:bg-indigo-500"
            type="submit"
          >
            Join
          </button>
        </div>
      </form>
    </section>
  );
}
