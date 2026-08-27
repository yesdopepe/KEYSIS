import "server-only";
import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "./session";
import { MEVZUAT_MIN_SEVIYE, BILGI_TABANI_MIN_SEVIYE } from "./seviyeler";

export async function oturumZorunluKil(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/giris");
  return session;
}

/** Guards /yonetim — a logged-in non-admin is sent back to /panel, not /giris. */
export async function oturumYoneticiZorunluKil(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/giris");
  if (!session.sistemYoneticisiMi) redirect("/panel");
  return session;
}

type YoneticiIzni = "mevzuatYonetimi" | "bilgiTabaniYonetimi";

const IZIN_SEVIYELERI: Record<YoneticiIzni, number> = {
  mevzuatYonetimi: MEVZUAT_MIN_SEVIYE,
  bilgiTabaniYonetimi: BILGI_TABANI_MIN_SEVIYE,
};

const IZIN_MESAJLARI: Record<YoneticiIzni, string> = {
  mevzuatYonetimi: "Mevzuat külliyatını yalnızca yetkili kullanıcılar yönetebilir.",
  bilgiTabaniYonetimi: "Kurum bilgi tabanını yalnızca yetkili kullanıcılar yönetebilir.",
};

/**
 * Shared replacement for the yoneticiOturumu() checks duplicated in
 * panel/mevzuat/actions.ts and panel/kurum-belgeleri/actions.ts. The
 * hiyerarsiSeviyesi threshold is an OR, not a replacement, with the role
 * flag: baskan_fen/baskan_sosyal (and every other legacy seviye-3 user)
 * must keep this access even though they have no role assigned — a role's
 * flag is an *additional* grant path, not the only one.
 */
export async function oturumIzinliKil(izin: YoneticiIzni): Promise<SessionPayload> {
  const session = await oturumZorunluKil();
  const izinliMi =
    // A third grant path, alongside the level threshold and the role flag:
    // the system administrator. The seeded sistem_admin has hiyerarsiSeviyesi
    // 1 and no role, so both other paths resolve to false and the account that
    // administers everything else could not upload a single mevzuat article —
    // with no alternative route, since /yonetim only covers kurum/birim/rol.
    session.sistemYoneticisiMi ||
    session.hiyerarsiSeviyesi >= IZIN_SEVIYELERI[izin] ||
    session[izin] === true;
  if (!izinliMi) throw new Error(IZIN_MESAJLARI[izin]);
  return session;
}
