import { FormEvent, useState } from "react";
import { api } from "../api/cms";

type Category = "game" | "launcher" | "website";

export default function BugReport() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("launcher");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ id: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const attachments = {
        launcherVersion: "0.1.0",
        userAgent: navigator.userAgent,
        platform: navigator.platform,
      };
      const r = await api.submitTicket({
        title,
        category,
        description,
        attachments,
      });
      setResult(r);
      setTitle("");
      setDescription("");
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Report a bug</h1>

      {result ? (
        <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/40 p-6 text-sm text-emerald-200">
          <div className="font-semibold text-emerald-300">Thanks — ticket {result.id} submitted.</div>
          <div className="mt-1">
            Track progress:{" "}
            <a
              href={result.url}
              target="_blank"
              rel="noreferrer"
              className="text-violet-200 underline underline-offset-2"
            >
              {result.url}
            </a>
          </div>
          <button
            onClick={() => setResult(null)}
            className="mt-3 rounded bg-neutral-800 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
          >
            Submit another
          </button>
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-400">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              required
              maxLength={200}
              className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-400">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.currentTarget.value as Category)}
              className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
            >
              <option value="game">Game</option>
              <option value="launcher">Launcher</option>
              <option value="website">Website</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-400">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.currentTarget.value)}
              rows={8}
              required
              maxLength={5000}
              className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
            />
          </label>
          <div className="rounded border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-400">
            <div className="mb-1 font-semibold text-neutral-300">Will be attached</div>
            <ul className="list-disc pl-4">
              <li>Launcher version</li>
              <li>User agent / platform</li>
            </ul>
          </div>
          {error && (
            <div className="rounded border border-red-900/60 bg-red-950/40 p-2 text-xs text-red-200">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="mt-2 self-start rounded bg-violet-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-violet-400 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Submit"}
          </button>
        </form>
      )}
    </div>
  );
}

