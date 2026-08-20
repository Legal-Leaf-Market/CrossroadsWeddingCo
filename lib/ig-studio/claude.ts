const ANTHROPIC_VERSION = "2023-06-01";

export async function callClaude({
  system,
  user,
  useSearch,
}: {
  system: string;
  user: string;
  useSearch: boolean;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const model = process.env.IG_STUDIO_MODEL || "claude-haiku-4-5-20251001";
  const body: Record<string, unknown> = {
    model,
    max_tokens: 4000,
    system,
    messages: [{ role: "user", content: user }],
  };
  if (useSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }];
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${detail.slice(0, 300)}`);
  }

  const json = await res.json();
  const content = (json.content || []) as Array<{ type: string; text?: string }>;
  return content
    .filter((b) => b.type === "text")
    .map((b) => b.text || "")
    .join("");
}

/* The model is asked for bare JSON and usually complies, but a stray sentence
   before it is the most common way this fails, so the first balanced block is
   taken rather than trusting the whole body to parse. */
export function extractJson(text: string): unknown {
  const t = (text || "").trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : t;
  const start = body.search(/[[{]/);
  if (start < 0) return null;
  const open = body[start];
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < body.length; i++) {
    const c = body[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === "\\") {
      esc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (c === open) depth++;
    else if (c === close && --depth === 0) {
      try {
        return JSON.parse(body.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}
