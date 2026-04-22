import { invoke } from "@tauri-apps/api/core";
import { cmsBase } from "./cms";

export type LoginResult =
  | { kind: "ok"; username: string }
  | { kind: "needs2fa"; pendingToken: string };

type RawLoginResult =
  | { kind: "Ok"; username: string }
  | { kind: "Needs2fa"; pendingToken: string };

function normalize(raw: RawLoginResult): LoginResult {
  if (raw.kind === "Ok") return { kind: "ok", username: raw.username };
  return { kind: "needs2fa", pendingToken: raw.pendingToken };
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const raw = await invoke<RawLoginResult>("auth_login", {
    cmsBase: cmsBase(),
    username,
    password,
  });
  return normalize(raw);
}

export async function login2fa(
  pendingToken: string,
  code: string,
  username: string,
): Promise<LoginResult> {
  const raw = await invoke<RawLoginResult>("auth_login_2fa", {
    cmsBase: cmsBase(),
    pendingToken,
    code,
    username,
  });
  return normalize(raw);
}

export async function logout(): Promise<void> {
  await invoke("auth_logout", { cmsBase: cmsBase() });
}

export async function hasToken(): Promise<boolean> {
  return await invoke<boolean>("auth_has_token");
}
