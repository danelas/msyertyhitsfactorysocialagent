import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const API_BASE = "https://api.upload-post.com/api";

export type Platform = "tiktok" | "instagram" | "facebook";

type PostInput = {
  caption: string;
  title?: string;
  mediaPath: string;
  platforms: Platform[];
  scheduledTime?: Date;
};

function authHeader(): Record<string, string> {
  const key = process.env.UPLOAD_POST_API_KEY;
  if (!key) throw new Error("UPLOAD_POST_API_KEY not set");
  return { Authorization: `Apikey ${key}` };
}

function userProfile(): string {
  const user = process.env.UPLOAD_POST_USER;
  if (!user) {
    throw new Error(
      "UPLOAD_POST_USER not set — this is the profile name in your Upload-Post dashboard that has Mystery Hits Factory's TikTok/IG/FB connected."
    );
  }
  return user;
}

export async function postVideo(input: PostInput): Promise<unknown> {
  const fileBuf = await readFile(input.mediaPath);
  const fileName = basename(input.mediaPath);
  const blob = new Blob([fileBuf]);

  const form = new FormData();
  form.append("user", userProfile());
  for (const p of input.platforms) form.append("platform[]", p);
  if (input.scheduledTime) {
    form.append("scheduled_time", input.scheduledTime.toISOString());
  }
  form.append("video", blob, fileName);
  form.append("title", input.title ?? input.caption.slice(0, 90));
  form.append("description", input.caption);

  // Explicit FB Page routing. Without this, Upload-Post auto-routes to
  // whichever Page is OAuth-granted to the profile — and the FB user behind
  // this account also manages other Pages (Bloom Roster, Gold Touch List), so
  // a stale OAuth grant can silently land posts on the wrong Page.
  if (input.platforms.includes("facebook")) {
    const pageId = process.env.FACEBOOK_PAGE_ID;
    if (!pageId) {
      throw new Error(
        "FACEBOOK_PAGE_ID not set — required when posting to Facebook to prevent misrouted posts. " +
          "Get the ID from https://api.upload-post.com/api/uploadposts/facebook/pages?profile=" +
          encodeURIComponent(userProfile()) +
          " (or FB Page → About → Page transparency → Page ID)."
      );
    }
    form.append("facebook_page_id", pageId);
  }

  const resp = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    headers: authHeader(),
    body: form,
  });
  const bodyText = await resp.text();
  if (!resp.ok) {
    throw new Error(`upload-post failed: ${resp.status} ${bodyText}`);
  }
  try {
    return JSON.parse(bodyText);
  } catch {
    return bodyText;
  }
}
