import { useEffect, useState } from "react";
import { api, cmsBase, type ShopSso } from "../api/cms";

export default function Shop() {
  const [sso, setSso] = useState<ShopSso | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.shopSso().then(setSso).catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return <div className="rounded border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>;
  }

  if (!sso) return <div className="text-neutral-500">Authenticating shop…</div>;

  return (
    <div className="flex h-[calc(100vh-180px)] flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Shop</h1>
        <a
          href={`${cmsBase()}/shop?sso=${sso.ssoToken}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-neutral-400 hover:text-amber-300"
        >
          Open in browser ↗
        </a>
      </div>
      <iframe
        title="Starfall shop"
        src={`${sso.url}?sso=${sso.ssoToken}`}
        className="h-full w-full flex-1 rounded-lg border border-neutral-800"
      />
    </div>
  );
}
