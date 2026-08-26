"use client";

import { useRef, useState } from "react";

type Photo = {
  id: string;
  url: string;
  thumb: string;
  photographer: string;
  photographerUrl: string;
  downloadLocation: string;
};

type Finding = {
  headline: string;
  what: string;
  why: string;
  angle: string;
  sources: string[];
  confidence: "high" | "medium" | "low";
};

type Draft = {
  overlayHeadline: string;
  overlaySubhead: string;
  caption: string;
  hashtags: string[];
};

type Claim = { claim: string; source: string; confidence: string };

const TOKEN_KEY = "cwc_ig_studio_token";
const CANVAS_SIZE = 1080;
const PREVIEW_SIZE = 380;

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("could not read image"));
    reader.readAsDataURL(blob);
  });
}

export default function IgStudioClient() {
  const [token, setToken] = useState<string>(() =>
    typeof window === "undefined" ? "" : window.sessionStorage.getItem(TOKEN_KEY) || "",
  );
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string>("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [checkedClaims, setCheckedClaims] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const slideRef = useRef<HTMLDivElement>(null);

  function ensureToken(): string | null {
    if (token) return token;
    const entered = window.prompt("Studio token:");
    if (!entered) return null;
    setToken(entered);
    window.sessionStorage.setItem(TOKEN_KEY, entered);
    return entered;
  }

  async function callStudio(body: Record<string, unknown>) {
    const t = ensureToken();
    if (!t) throw new Error("No token provided");
    const res = await fetch("/api/ig-research", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-studio-token": t },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (res.status === 401) {
      window.sessionStorage.removeItem(TOKEN_KEY);
      setToken("");
      throw new Error("Token rejected. Try again.");
    }
    if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
    return json;
  }

  async function runResearch() {
    setBusy(true);
    setError("");
    setStatus("Researching…");
    setFindings([]);
    setPhotos([]);
    setSelectedFinding(null);
    setSelectedPhoto(null);
    setDraft(null);
    try {
      const json = await callStudio({ mode: "findings", topic });
      setFindings(json.findings || []);
      setPhotos(json.photos || []);
      setStatus(`${(json.findings || []).length} ideas, ${(json.photos || []).length} photos`);
    } catch (err) {
      setError((err as Error).message);
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function selectPhoto(photo: Photo) {
    setSelectedPhoto(photo);
    setPhotoDataUrl("");
    try {
      const res = await fetch(`/api/ig-research/image?url=${encodeURIComponent(photo.url)}`);
      const blob = await res.blob();
      setPhotoDataUrl(await readBlobAsDataUrl(blob));
    } catch {
      setError("Could not load that photo");
    }
  }

  async function runDraft() {
    if (!selectedFinding) return;
    setBusy(true);
    setError("");
    setStatus("Drafting…");
    try {
      const json = await callStudio({
        mode: "draft",
        finding: selectedFinding,
        photoDownloadLocation: selectedPhoto?.downloadLocation,
      });
      setDraft(json.draft);
      setClaims(json.claims || []);
      setCheckedClaims(new Set());
      setStatus("Draft ready");
    } catch (err) {
      setError((err as Error).message);
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function exportPng() {
    const node = slideRef.current;
    if (!node) return;
    setError("");
    try {
      const xhtml = new XMLSerializer().serializeToString(node);
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}">` +
        `<foreignObject width="100%" height="100%">` +
        `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${CANVAS_SIZE}px;height:${CANVAS_SIZE}px;">${xhtml}</div>` +
        `</foreignObject></svg>`;
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      const png = await new Promise<Blob>((resolve, reject) => {
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = CANVAS_SIZE;
          canvas.height = CANVAS_SIZE;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("no canvas context"));
          ctx.fillStyle = "#2b2622";
          ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas produced no blob"))), "image/png");
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("the slide markup isn't well-formed enough to rasterize"));
        };
        img.src = url;
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(png);
      a.download = `crossroads-ig-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const scale = PREVIEW_SIZE / CANVAS_SIZE;
  const allClaimsChecked = claims.length === 0 || claims.every((_, i) => checkedClaims.has(i));

  return (
    <div style={{ minHeight: "100vh", background: "#211d19", color: "#f3ece0", fontFamily: "system-ui, sans-serif" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          padding: "16px 20px",
          borderBottom: "1px solid #46392c",
          background: "rgba(33,29,25,.95)",
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ fontSize: 16, margin: 0 }}>
          IG <span style={{ color: "#e2895e" }}>Studio</span>
        </h1>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Topic to chase (blank = general sweep)"
          style={{
            flex: "1 1 260px",
            background: "#29241f",
            border: "1px solid #46392c",
            borderRadius: 8,
            padding: "8px 12px",
            color: "#f3ece0",
          }}
        />
        <button onClick={runResearch} disabled={busy} style={btnStyle(true)}>
          Research
        </button>
        <span style={{ fontSize: 13, color: "#b3a696" }}>{status}</span>
      </header>

      <main style={{ padding: 20, maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        {error && (
          <div style={{ color: "#e2895e", fontSize: 14 }}>
            {error}
          </div>
        )}

        {findings.length > 0 && (
          <section>
            <h2 style={sectionH2}>Findings: pick one</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {findings.map((f, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedFinding(f)}
                  style={{
                    textAlign: "left",
                    padding: 14,
                    borderRadius: 10,
                    border: `1px solid ${selectedFinding === f ? "#e2895e" : "#46392c"}`,
                    background: selectedFinding === f ? "#e2895e1a" : "#29241f",
                    color: "#f3ece0",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{f.headline}</div>
                  <div style={{ fontSize: 13, color: "#b3a696", marginBottom: 4 }}>{f.what}</div>
                  <div style={{ fontSize: 12, color: "#9db08a" }}>Angle: {f.angle}</div>
                  <div style={{ fontSize: 11, textTransform: "uppercase", color: "#7d9488", marginTop: 6 }}>
                    Confidence: {f.confidence}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {photos.length > 0 && (
          <section>
            <h2 style={sectionH2}>Photos: pick one</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
              {photos.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectPhoto(p)}
                  style={{
                    padding: 0,
                    border: `2px solid ${selectedPhoto?.id === p.id ? "#e2895e" : "transparent"}`,
                    borderRadius: 10,
                    overflow: "hidden",
                    cursor: "pointer",
                    background: "none",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumb} alt="" style={{ width: "100%", display: "block", aspectRatio: "1" }} />
                  <div style={{ fontSize: 10, color: "#7d9488", padding: 4 }}>{p.photographer}</div>
                </button>
              ))}
            </div>
          </section>
        )}

        {selectedFinding && (
          <section>
            <button onClick={runDraft} disabled={busy} style={btnStyle(true)}>
              Draft this post
            </button>
          </section>
        )}

        {draft && (
          <section style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 24 }}>
            <div>
              <div
                style={{
                  width: PREVIEW_SIZE,
                  height: PREVIEW_SIZE,
                  overflow: "hidden",
                  borderRadius: 12,
                  border: "1px solid #46392c",
                }}
              >
                <div
                  ref={slideRef}
                  style={{
                    width: CANVAS_SIZE,
                    height: CANVAS_SIZE,
                    transform: `scale(${scale})`,
                    transformOrigin: "0 0",
                    position: "relative",
                    background: "#2b2622",
                    fontFamily: "Georgia, 'Times New Roman', serif",
                  }}
                >
                  {photoDataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoDataUrl}
                      alt=""
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  )}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(to top, rgba(43,38,34,.92) 0%, rgba(43,38,34,.55) 45%, rgba(43,38,34,0) 75%)",
                    }}
                  />
                  <div style={{ position: "absolute", left: 64, right: 64, bottom: 90 }}>
                    <div style={{ fontSize: 68, fontWeight: 700, color: "#faf5ec", lineHeight: 1.1 }}>
                      {draft.overlayHeadline}
                    </div>
                    {draft.overlaySubhead && (
                      <div style={{ fontSize: 30, color: "#f1e6d3", marginTop: 16, fontStyle: "italic" }}>
                        {draft.overlaySubhead}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      left: 64,
                      bottom: 40,
                      fontSize: 20,
                      letterSpacing: 3,
                      textTransform: "uppercase",
                      color: "#c1633d",
                      fontFamily: "system-ui, sans-serif",
                      fontWeight: 700,
                    }}
                  >
                    Crossroads Wedding Co.
                  </div>
                </div>
              </div>
              <button onClick={exportPng} disabled={!allClaimsChecked} style={{ ...btnStyle(allClaimsChecked), marginTop: 12, width: PREVIEW_SIZE }}>
                {allClaimsChecked ? "Download PNG" : "Check claims to export"}
              </button>
              {selectedPhoto && (
                <div style={{ fontSize: 11, color: "#7d9488", marginTop: 8 }}>
                  Photo by{" "}
                  <a href={selectedPhoto.photographerUrl} target="_blank" rel="noreferrer" style={{ color: "#9db08a" }}>
                    {selectedPhoto.photographer}
                  </a>{" "}
                  on Unsplash
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
              {claims.length > 0 && (
                <div style={{ border: "1px solid #f0b93c", borderRadius: 10, padding: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Verify before exporting</div>
                  {claims.map((c, i) => (
                    <label key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 0" }}>
                      <input
                        type="checkbox"
                        checked={checkedClaims.has(i)}
                        onChange={(e) => {
                          const next = new Set(checkedClaims);
                          if (e.target.checked) next.add(i);
                          else next.delete(i);
                          setCheckedClaims(next);
                        }}
                      />
                      <span style={{ fontSize: 13 }}>
                        {c.claim}{" "}
                        <a href={c.source} target="_blank" rel="noreferrer" style={{ color: "#9db08a" }}>
                          source
                        </a>
                      </span>
                    </label>
                  ))}
                </div>
              )}

              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#7d9488", marginBottom: 6 }}>
                  Caption
                </div>
                <textarea
                  value={draft.caption}
                  onChange={(e) => setDraft({ ...draft, caption: e.target.value })}
                  rows={8}
                  style={{
                    width: "100%",
                    background: "#29241f",
                    border: "1px solid #46392c",
                    borderRadius: 8,
                    padding: 12,
                    color: "#f3ece0",
                    fontFamily: "inherit",
                    fontSize: 14,
                  }}
                />
              </div>

              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#7d9488", marginBottom: 6 }}>
                  Hashtags
                </div>
                <div style={{ fontSize: 13, color: "#9db08a" }}>{draft.hashtags.join(" ")}</div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

const sectionH2: React.CSSProperties = { fontSize: 14, textTransform: "uppercase", letterSpacing: 1, color: "#b3a696", marginBottom: 10 };

function btnStyle(enabled: boolean): React.CSSProperties {
  return {
    padding: "8px 16px",
    borderRadius: 8,
    border: "1px solid #e2895e",
    background: enabled ? "#e2895e" : "#46392c",
    color: enabled ? "#2b2622" : "#7d9488",
    fontWeight: 700,
    cursor: enabled ? "pointer" : "not-allowed",
  };
}
