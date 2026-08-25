import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me"
);
const COOKIE_NAME = "ebys_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 saat

export interface SessionPayload {
  userId: string;
  kullaniciAdi: string;
  adSoyad: string;
  kurumId: string;
  birimId: string;
  hiyerarsiSeviyesi: number;
  unvan: string;
  sistemYoneticisiMi: boolean;
  // Resolved from the user's role (if any) at login — not a kullanicilar
  // column, since unlike hiyerarsiSeviyesi/unvan these have no legacy
  // hand-set data to preserve. See lib/auth/require-session.ts.
  mevzuatYonetimi: boolean;
  bilgiTabaniYonetimi: boolean;
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(SECRET);

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
