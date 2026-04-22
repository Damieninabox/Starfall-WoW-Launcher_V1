# Starfall Mock Manifest Server

Local server for patcher end-to-end testing. Serves:

- `GET /manifests/cata.json` — dynamic manifest with real SHA-256 hashes
- `GET /files/<path>` — the three test files, with HTTP `Range` support
- `POST /_regenerate` — regenerate random bytes (new manifest version)

## Run

```bash
node server.js
```

Listens on `http://127.0.0.1:8787`.

Test files generated on first start under `./files/`:
- `test1.bin` — 1 MB random bytes
- `test2.bin` — 5 MB random bytes
- `README.txt` — a few lines of text

## Verify Range support

```bash
curl -r 0-1023 -o /dev/null -w "%{http_code} %{size_download}\n" http://127.0.0.1:8787/files/test1.bin
# -> 206 1024
```
