import dotenv from "dotenv";
dotenv.config({ override: true });

/**
 * Diagnostic: ask Upload-Post which platforms are actually connected for our
 * profile, so we can confirm Instagram / Facebook / TikTok are linked WITHOUT
 * doing a full render + post. Exits non-zero if any target platform is missing
 * so it shows red in CI.
 *
 *   cd clipper && npm run check
 */

const API_BASE = "https://api.upload-post.com/api";
const TARGETS = ["tiktok", "instagram", "facebook"] as const;

function authHeader(): Record<string, string> {
  const key = process.env.UPLOAD_POST_API_KEY;
  if (!key) throw new Error("UPLOAD_POST_API_KEY not set");
  return { Authorization: `Apikey ${key}` };
}

/** Upload-Post represents a connected platform as an object with details;
 *  not-connected is an empty string or null. */
function isConnected(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && Object.keys(v as object).length > 0;
}

type UsersResponse = {
  profiles?: Array<{
    username: string;
    created_at?: string;
    social_accounts?: Record<string, unknown>;
  }>;
};

async function main() {
  const user = process.env.UPLOAD_POST_USER;
  if (!user) throw new Error("UPLOAD_POST_USER not set");

  const resp = await fetch(`${API_BASE}/uploadposts/users`, {
    headers: authHeader(),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`users lookup failed: ${resp.status} ${text}`);
  }
  const data = JSON.parse(text) as UsersResponse;
  const profiles = data.profiles ?? [];

  const profile = profiles.find((p) => p.username === user);
  if (!profile) {
    console.error(`[check] profile "${user}" not found under this API key.`);
    console.error(
      `[check] profiles on this key: ${
        profiles.map((p) => p.username).join(", ") || "(none)"
      }`
    );
    process.exit(1);
  }

  const accounts = profile.social_accounts ?? {};
  console.log(`[check] Upload-Post profile: ${user}`);
  const missing: string[] = [];
  for (const p of TARGETS) {
    const acct = accounts[p];
    if (isConnected(acct)) {
      const name = (acct.display_name as string) ?? (acct.username as string) ?? "";
      console.log(`[check]   ✓ ${p}${name ? ` — ${name}` : ""}`);
    } else {
      console.log(`[check]   ✗ ${p} — NOT connected`);
      missing.push(p);
    }
  }

  // Facebook needs a specific Page id to post; surface what's available and
  // whether our configured FACEBOOK_PAGE_ID is among them.
  if (isConnected(accounts.facebook)) {
    try {
      const pr = await fetch(
        `${API_BASE}/uploadposts/facebook/pages?profile=${encodeURIComponent(user)}`,
        { headers: authHeader() }
      );
      const pt = await pr.text();
      if (pr.ok) {
        console.log(`[check]   facebook pages: ${pt.slice(0, 400)}`);
        const wantId = process.env.FACEBOOK_PAGE_ID;
        if (!wantId) {
          console.warn(
            `[check]   ⚠ FACEBOOK_PAGE_ID is not set — required to post to Facebook (prevents misrouted posts).`
          );
        } else if (!pt.includes(wantId)) {
          console.warn(
            `[check]   ⚠ FACEBOOK_PAGE_ID (${wantId}) was not found in the pages above — it may be wrong.`
          );
        }
      } else {
        console.warn(`[check]   ⚠ could not list facebook pages: ${pr.status} ${pt.slice(0, 200)}`);
      }
    } catch (err) {
      console.warn(`[check]   ⚠ facebook pages check failed: ${(err as Error).message}`);
    }
  }

  if (missing.length) {
    console.error(
      `[check] NOT connected: ${missing.join(", ")}. ` +
        `Reconnect them in the Upload-Post dashboard. Note: one Meta login covers BOTH ` +
        `Instagram and Facebook, and Instagram must be a Business/Creator account linked to a Facebook Page.`
    );
    process.exit(1);
  }
  console.log(`[check] all target platforms connected ✓`);
}

main().catch((err) => {
  console.error("[check] failed:", err);
  process.exit(1);
});
