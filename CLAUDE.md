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

## Current scope

**Phase 1 (Playable):**
- Patcher core: check/run/repair with resume, hash cache, atomic replace, parallel downloads, cancel
- Install page: folder picker, Check / Start / Pause / Repair, live progress
- Mock server (`mock-server/`) on `:8787` — `/manifests/cata.json`, `/files/*` with Range, plus the entire `/api/*` CMS surface for dev
- Realmlist read/write (UTF-8 no BOM, LF, all locales)
- Cache clear (Cache/ + WDB/ only; through `fs_safety`)
- Launch (Wow-64.exe / Wow.exe; no shell)
- Home Play flow: check → patch → sync realmlist → clear cache → launch
- Settings: install dir, realmlist, cache policy, launch args (persisted to localStorage)

**Phase 2 (Account features):**
- Auth: login + 2FA + refresh + logout via `keyring` (Windows Credential Manager) — frontend never sees tokens
- `cms_fetch` Tauri command proxies authenticated requests so JS can stay token-free
- Login page (with 2FA second screen) + protected route guard + `/login` redirect on missing token
- Characters page: list grouped by realm, sorted by last-played, embedded armory iframe
- Mythic+ page (tabs): current affixes, leaderboard, raid progression with first-kill credit
- Shop iframe with SSO token
- Settings: 2FA enroll/disable (otpauth URL + backup codes), session history, revoke-all
- Settings: WTF backup → zip / restore from zip (Rust `zip` crate, `fs_safety`-gated)
- Home widgets: server status (auto-refresh 30s), news, M+ affixes, two guild MOTD/event cards
- Dynamic background gradient on home per selected expansion

**Phase 3 (Engagement):**
- Refer a Friend page (link, code, signups, active, rewards earned/pending)
- Transmog wishlist (search items, add/remove, "Where?" reveals item sources)
- Bug Report form (title/category/description, auto-attaches launcher version + UA)
- Addons page (server-shipped addon list with on/off toggle persisted locally)

## Auth model

- Tauri command `auth_login(cms_base, username, password)` returns either `Ok` or `Needs2fa { pendingToken }`. On success, tokens go into Windows Credential Manager via `keyring` (service `com.starfall.launcher`).
- All authenticated UI calls go through `cms_fetch(cms_base, method, path, body)` which the Rust side reads the token from keyring and bearer-attaches. Frontend never holds a JWT.
- On 401 from the CMS, tokens are cleared and the protected-route guard kicks the user back to `/login`.

## Mock CMS

`mock-server/cms.js` ships every spec §4 endpoint with deterministic fake data. One mock account: `starfall` / `starfall`. To use it, start the mock and the launcher's default `VITE_CMS_BASE` env var is `http://127.0.0.1:8787`. Set it to the real CMS base URL in production.

## Out of scope (still)

- Real CMS — point `VITE_CMS_BASE` at the production host once it exists
- Auto-updater for the launcher itself
- Code signing
- Discord Rich Presence (deferred — Discord crate adds linker complexity on Windows; can add when there's a real RPC app id)
- Native armory rebuild (current iframe is good enough)

## Dev notes

- Windows Defender can kill rustc with `STATUS_STACK_BUFFER_OVERRUN` during fresh builds. If `cargo check` dies with `0xc0000409`, add exclusions for `%USERPROFILE%\.cargo`, `%USERPROFILE%\.rustup`, and the project's `src-tauri/target/` folder — or set `CARGO_INCREMENTAL=0`.
- WebView2 must be present on the target Windows machine. Windows 10 1803+ / Windows 11 ship it; older boxes need the bootstrapper.
- MySQL DB creds (for designing CMS endpoints in later sessions, **not** to be touched from the launcher): `localhost:3306`, user `root`, pw `ascent` — WoW 4.3.4 Cataclysm TrinityCore schema.
