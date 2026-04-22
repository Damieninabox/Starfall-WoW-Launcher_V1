# Starfall WoW Launcher — Working Context

Custom desktop launcher for a private World of Warcraft Cataclysm 4.3.4 server. Spec is [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); session prompt is [`docs/KICKOFF_PROMPT.md`](docs/KICKOFF_PROMPT.md). **If anything contradicts the spec, the spec wins — stop and ask.**

## Stack

- **Frontend:** React 19 + TypeScript + Vite 7 + Tailwind v4 + React Router 7 + Zustand 5
- **Backend:** Tauri 2 + Rust (reqwest, sha2, tokio full, walkdir, thiserror, tracing)
- **Bundle target:** `app` (portable exe) — not `nsis` or `msi`

## Run / build / test

```bash
pnpm install               # once
pnpm tauri dev             # dev app (Vite @1420, Tauri window)
pnpm typecheck             # tsc --noEmit
cd src-tauri && cargo check
cd src-tauri && cargo clippy -- -D warnings
pnpm tauri build           # portable exe under src-tauri/target/release/
```

The mock manifest server (Task 2) lives under `mock-server/` — see its README for start instructions.

## Layout

```
starfall-wow-launcher/
├── src/                       # React frontend
│   ├── pages/                 # Login, Home, Install, Characters, MythicPlus, Shop, Settings
│   ├── components/            # (empty — filled as features land)
│   ├── api/                   # (empty — CMS client lives here in later sessions)
│   ├── state/                 # Zustand stores (installer store added in Task 4)
│   ├── App.tsx                # Router + nav
│   ├── main.tsx
│   └── index.css              # @import "tailwindcss"
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs             # Tauri builder, command registry
│   │   ├── main.rs            # thin launcher
│   │   ├── commands/          # auth, patcher, realmlist, cache, launch
│   │   ├── fs_safety.rs       # assert_inside(root, target) — every write goes through this
│   │   └── hash_cache.rs      # persistent SHA-256 cache
│   └── tauri.conf.json
├── mock-server/               # (Task 2) local manifest host for patcher testing
└── docs/                      # ARCHITECTURE.md + KICKOFF_PROMPT.md
```

## Architectural decisions

1. **All disk writes go through `fs_safety::assert_inside(root, target)`** — no exceptions. Protects against path-traversal in manifests.
2. **No `unwrap()` / `expect()` in production paths.** Typed errors via `thiserror`; propagate with `?`.
3. **No shell-outs from JS.** Rust owns the filesystem, hashing, downloads, and process spawning.
4. **Progress events throttled to ~10/s** in Rust (not React) — spamming events causes UI jank.
5. **Hash cache** at `%APPDATA%/Starfall/hash-cache.json` keyed on `(mtime, size)`; mismatch → rehash.
6. **Atomic writes** — download to `<path>.partial`, rename on verified hash.
7. **Install location default:** `%LOCALAPPDATA%/Starfall/` (no admin required); user-overridable.

## Current scope (Sessions 1 + 2)

**Shipped:**
- Patcher core: check/run/repair with resume, hash cache, atomic replace, parallel downloads, cancel
- Install page: folder picker, Check / Start / Pause / Repair, live progress
- Mock manifest server (`mock-server/`) on `:8787` for dev
- Realmlist read/write — UTF-8 no BOM, LF endings, writes to every `Data/<locale>/` folder
- Cache clear — wipes `Cache/` + `WDB/` contents through `fs_safety`; never touches `WTF/`
- Launch — spawns `Wow-64.exe` (falls back to `Wow.exe`), no shell
- Home page: expansion picker (Cata active, 4 placeholders) + end-to-end **Play** flow: check → patch → sync realmlist → clear cache (per policy) → launch
- Settings page: install dir, realmlist server, cache policy (on-launch / weekly / manual / off), launch args
- Persistent launcher settings in `localStorage` via Zustand `persist`

**Out of scope (do not start without a session prompt):**
- Login / auth / 2FA / token storage / session history
- Characters, armory, Mythic+, raids, shop, guild, referrals, transmog, bug report
- News feed, server status widget, dynamic backgrounds
- Real CMS integration — currently hits the local mock server
- Auto-updater

## What to tackle next session

Session 3: login + auth + token storage (Windows Credential Manager via `keyring`), 2FA (TOTP), and the CMS-backed expansion config endpoint. That unblocks the character list / armory / shop stack.

## Dev notes

- Windows Defender can kill rustc with `STATUS_STACK_BUFFER_OVERRUN` during fresh builds. If `cargo check` dies with `0xc0000409`, add exclusions for `%USERPROFILE%\.cargo`, `%USERPROFILE%\.rustup`, and the project's `src-tauri/target/` folder — or set `CARGO_INCREMENTAL=0`.
- WebView2 must be present on the target Windows machine. Windows 10 1803+ / Windows 11 ship it; older boxes need the bootstrapper.
- MySQL DB creds (for designing CMS endpoints in later sessions, **not** to be touched from the launcher): `localhost:3306`, user `root`, pw `ascent` — WoW 4.3.4 Cataclysm TrinityCore schema.
