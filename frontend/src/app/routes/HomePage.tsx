import { Link, useNavigate } from "react-router-dom";

export function HomePage() {
  const navigate = useNavigate();

  const createRoom = () => {
    const roomId = generateRoomId();
    navigate(`/meeting/${encodeURIComponent(roomId)}`);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg backdrop-blur sm:p-7">
          <p className="mb-2 inline-block rounded-full bg-emerald-600/20 px-3 py-1 text-xs font-medium text-emerald-300">
            Private by default
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">ASA Meet Net</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
            Anonymous meetings with ephemeral, encrypted communication. No account creation,
            no permanent room data, and mobile-friendly controls.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
          <h2 className="text-lg font-semibold">Start a room in one tap</h2>
          <p className="mt-2 text-sm text-slate-300">
            Room IDs are generated randomly and cannot be chosen manually.
          </p>
          <button
            className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-3 text-base font-semibold transition hover:bg-indigo-500 active:scale-[0.99] sm:w-auto"
            type="button"
            onClick={createRoom}
          >
            Create Secure Room
          </button>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <FeatureCard title="No sign-up required" text="Share your room link and join instantly." />
          <FeatureCard title="Ephemeral by design" text="Messages and files auto-expire and are removed." />
          <FeatureCard title="E2EE chat + file transfer" text="Content is encrypted before leaving the browser." />
          <FeatureCard title="Works on mobile" text="Large controls and responsive layout for touch screens." />
        </section>

        <p className="text-xs text-slate-400 sm:text-sm">
          Direct link format:{" "}
          <Link className="underline underline-offset-2" to="/meeting/demo-room">
            /meeting/&lt;roomId&gt;
          </Link>
        </p>
      </div>
    </main>
  );
}

function FeatureCard({ title, text }: Readonly<{ title: string; text: string }>) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      <p className="mt-1 text-sm text-slate-300">{text}</p>
    </article>
  );
}

function generateRoomId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
