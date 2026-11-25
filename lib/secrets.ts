import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Encryption at rest for third-party credentials (bank aggregator access
// tokens today; payout and tax ids later). AES-256-GCM under one key held only
// in the environment: INTEGRATIONS_KEY, 32 bytes as 64 hex characters.
// Generate one with: openssl rand -hex 32
//
// Format: "v1:<iv b64>:<tag b64>:<ciphertext b64>". The version prefix lets a
// later key rotation decrypt old rows with the old key and re-encrypt them.
//
// Fails closed: with no valid key, encryptSecret throws, so a connection
// cannot be saved with its token in the clear.

function key(): Buffer | null {
  const raw = process.env.INTEGRATIONS_KEY ?? "";
  return /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : null;
}

export function secretsConfigured(): boolean {
  return key() !== null;
}

export function encryptSecret(plain: string): string {
  const k = key();
  if (!k) throw new Error("INTEGRATIONS_KEY is not set (64 hex characters); refusing to store a credential.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

export function decryptSecret(stored: string): string {
  const k = key();
  if (!k) throw new Error("INTEGRATIONS_KEY is not set; cannot read stored credentials.");
  const [v, iv, tag, ct] = stored.split(":");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Unrecognized secret format.");
  const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
}
