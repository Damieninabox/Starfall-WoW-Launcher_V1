# First Claude Code Session — Kickoff Prompt

> Paste the content between the `===` markers into Claude Code to start building.
> This prompt is scoped to **one session**: scaffold + patcher against a mock server.
> Do not try to build the whole launcher in one go — subsequent sessions will each have their own focused prompt.

---

```
===BEGIN PROMPT===

You are starting work on `wow-launcher` — a custom desktop launcher for a private World of Warcraft Cataclysm 4.3.4 server. Read `docs/ARCHITECTURE.md` first; it is the source of truth. If anything in this prompt contradicts the spec, the spec wins — stop and ask.

# Session scope

This session only. Do not go beyond this list; future sessions will handle the rest.

1. Scaffold the project
2. Build a local mock manifest server
3. Implement the patcher core (Rust) end-to-end against the mock
4. Build a minimal Install page to drive the patcher
5. Verify the whole thing works: fresh folder → install → resume-after-kill → repair

# Out of scope this session — do not start

- Login / auth / token storage
- Realmlist writing, cache clearing, spawning Wow.exe
- Character list, armory, Mythic+, raid progression, shop, guild widget, referrals, transmog, bug report form
- News feed, server status widget, 2FA, session history, dynamic backgrounds
- Any real CMS integration — everything hits the mock server
- Expansion picker UI beyond a single hardcoded Cata placeholder

If you catch yourself wandering into any of these, stop and come back to the patcher.

# Stack (non-negotiable)

- Tauri 2 + React 18 + TypeScript + Vite + Tailwind
- Zustand for state
- React Router for navigation
- Rust crates: `reqwest` (with `stream` and `rustls-tls`), `sha2`, `serde` + `serde_json`, `tokio` (full features), `walkdir`, `thiserror`, `tracing` + `tracing-subscriber`
- Bundle target: `app` (portable exe) — not `nsis` or `msi`

Windows 11 is the target. If you're developing on macOS/Linux, `cargo check` and `clippy` must pass, and flag anything that needs Windows verification in the PR description.

# Tasks in order

## Task 1 — Scaffold

- `pnpm create tauri-app` (or equivalent) with React-TS template
- Add Tailwind, Zustand, React Router
- Folder structure per ARCHITECTURE.md section 5
- Configure `tauri.conf.json` for portable single-exe output
- Placeholder pages: Login, Home, Install, Characters, MythicPlus, Shop, Settings — each just a heading with the page name, routed via React Router
- Rust command modules stubbed in `src-tauri/src/commands/`: `auth.rs`, `patcher.rs`, `realmlist.rs`, `cache.rs`, `launch.rs` — each with command signatures registered in `main.rs` and `todo!()` bodies (except `patcher.rs`, which you'll fill in Task 3)
- Verify: `cargo tauri dev` launches a window; `cargo tauri build` produces a single `.exe` in `src-tauri/target/release/`

## Task 2 — Mock manifest server

Separate top-level directory: `mock-server/`. Use Node + Express or Rust + axum — your call, pick whichever is faster to set up.

- Serves `GET /manifests/cata.json` with a manifest matching the shape in ARCHITECTURE.md section 3.3
- Manifest references 3 real test files (e.g., `test1.bin` = 1 MB of random bytes, `test2.bin` = 5 MB, `README.txt` = a few lines). Generate them at server start if missing.
- Serves the files at the URLs in the manifest
- Supports HTTP `Range` requests (required for resume testing)
- Listens on `http://localhost:8787`
- Include a `README.md` with one-line start instructions

## Task 3 — Patcher core (Rust)

File: `src-tauri/src/commands/patcher.rs` plus `src-tauri/src/hash_cache.rs` and `src-tauri/src/fs_safety.rs`.

Required behaviors:

- **Fetch manifest** from a URL, parse into typed structs
- **Hash cache** at `%APPDATA%/<Launcher>/hash-cache.json` mapping `path → { mtime, size, sha256 }`. Rehash only when mtime or size changes. Never trust the cache if `size` mismatches the on-disk file.
- **Work list builder:** for each manifest entry, decide `download | replace | skip`. Also process `deletions`.
- **Parallel downloads:** 3 concurrent (configurable via a constant for now), using `tokio::spawn` + a semaphore
- **Resume:** write to `<path>.partial`, resume via HTTP `Range` header if a `.partial` exists and is smaller than expected
- **Verification:** SHA-256 the completed download, compare to manifest. Mismatch → delete and retry once; second failure → propagate error.
- **Atomic replace:** only after verification, rename `.partial` → final path
- **Path safety (`fs_safety.rs`):** every write canonicalizes the target and asserts it's inside the configured install root. Unit test this with adversarial inputs (`..`, symlinks, absolute paths).
- **Progress events:** emit Tauri events to the frontend — `patcher:progress` with `{ currentFile, fileBytesDone, fileBytesTotal, overallBytesDone, overallBytesTotal, bytesPerSec, status }`. Throttle to ~10 events/sec max; spamming events causes UI jank.
- **Error handling:** use `thiserror`-based enum. No `unwrap()` in production paths. Every error variant should be user-meaningful (not just "IO error").

Commands exposed to the frontend:

- `patcher_check(install_dir: String, manifest_url: String) -> WorkSummary` — returns what would be done without doing it
- `patcher_run(install_dir: String, manifest_url: String) -> Result<(), PatcherError>` — does the work, emits progress events
- `patcher_repair(install_dir: String, manifest_url: String) -> Result<(), PatcherError>` — forces full rehash, ignores cache

## Task 4 — Install page (React)

Minimum viable UI to exercise the patcher. Don't polish it — that's for later.

- Folder picker (Tauri's `dialog` plugin)
- "Check" button → calls `patcher_check`, displays summary (N files to download, total MB)
- "Start install" button → calls `patcher_run`
- Live progress panel consuming `patcher:progress` events via Zustand:
  - Overall progress bar with percent
  - Current file name
  - Speed (MB/s)
  - ETA (seconds remaining at current rate)
- "Pause" button (abort the run; resume on next Start is free because of `.partial` files)
- "Repair" button → calls `patcher_repair`

State management: one Zustand store called `installer` with all of the above fields.

## Task 5 — End-to-end verification

Manually run this sequence. If any step fails, fix and re-run all steps.

1. Start mock server: files generated, endpoints respond
2. `cargo tauri dev` → app launches → navigate to Install page
3. Pick an empty folder → Check → shows "3 files, ~6 MB"
4. Start install → progress updates smoothly → completes → all 3 files present in target folder, hashes match manifest
5. Delete one file on disk → Repair → only that file re-downloads
6. Corrupt one file (flip some bytes) → Repair → corrupted file re-downloads
7. Start a fresh install, kill the launcher mid-download → relaunch → Start → resumes from `.partial`, does not restart from byte 0
8. Point patcher at an invalid manifest URL → clear error message in UI, no crash
9. Run `cargo clippy -- -D warnings` and `pnpm tsc --noEmit` — both clean

Capture a short GIF or screenshot sequence in `docs/phase-1-demo/` for reference.

# Housekeeping

- Branch: `feat/phase-1-patcher`
- Commit in logical chunks, not a single mega-commit. Suggested breakpoints: after scaffold / after mock server / after each major patcher capability / after UI / after E2E verification.
- Write `CLAUDE.md` at repo root (under 100 lines) with: stack summary, how to run dev/build/test, running the mock server, key architectural decisions, current scope boundary, and "what to tackle next session." This is the starting context for every future Claude Code session on this repo.
- Update `docs/ARCHITECTURE.md` only if you hit a spec error or ambiguity; otherwise leave it alone.
- PR description at the end summarizes: what shipped, what didn't, anything you noticed that the spec should address, and a checklist of the 9 verification steps above with pass/fail.

# Ground rules

- No `unwrap()` or `expect()` in production paths (tests fine). Use `?` with typed errors.
- No `shell: true` / no spawning subprocesses via shell strings. Ever.
- No dependencies that haven't been vetted — stick to the crates listed above for Rust. If you want to add one, justify it in the PR.
- Every path you write to goes through `fs_safety::assert_inside(root, target)` first. No exceptions.
- `cargo audit` and `pnpm audit --prod` must pass (warnings on dev-deps OK, block on prod).
- If something in this prompt seems wrong or impossible, stop and ask before routing around it. Don't invent a workaround silently.

===END PROMPT===
```

---

## How to use this

1. Have the spec ready: commit `docs/ARCHITECTURE.md` into an empty `wow-launcher/` repo before starting Claude Code.
2. Start a Claude Code session with the repo as working directory.
3. Paste the prompt between the `===` markers.
4. Let it work. Review commits as they land rather than waiting until the end.
5. When the session finishes the verification checklist, ask me for the **Session 2 prompt** — that one will swap the mock server for your real patch host, build realmlist/cache/launch, and handle the full Cata client install.

## If Claude Code gets stuck

Common escape valves:

- **"I don't have docs/ARCHITECTURE.md"** — you forgot to commit it before starting. Commit it, restart session.
- **"Tauri bundler won't produce a portable exe"** — in Tauri 2, set `bundle.targets` to `["app"]` in `tauri.conf.json`. If you get a platform-specific error on non-Windows dev machines, cross-compile target is `x86_64-pc-windows-msvc` (requires `xwin` or a Windows machine).
- **"Progress events are lagging the UI"** — throttle emission rate in Rust, not React. A simple `last_emit: Instant` + `if elapsed > 100ms` guard works.
- **"Resume isn't working"** — your server likely doesn't support `Range` requests. Test with `curl -r 0-1000 http://localhost:8787/...` first.
