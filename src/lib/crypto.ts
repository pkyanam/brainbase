/**
 * Encryption helpers for sensitive Brainbase data.
 *
 * Uses AES-256-GCM with a 32-byte key from BRAINBASE_ENCRYPTION_KEY env var.
 *
 * Security model:
 * - Key is stored in Vercel env (never in DB, never in repo)
 * - Ciphertext, IV, and auth tag are stored in DB
 * - Key rotation: decrypt with old key, re-encrypt with new key
 */
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY = process.env.BRAINBASE_ENCRYPTION_KEY;

if (!KEY || KEY.length !== 32) {
  console.warn(
    "[crypto] BRAINBASE_ENCRYPTION_KEY not set or not 32 chars. Encryption disabled."
  );
}

export interface EncryptedField {
  ciphertext: string; // base64
  iv: string; // base64
  tag: string; // base64
}

/**
 * Encrypt a plaintext string.
 */
export function encrypt(text: string): EncryptedField {
  if (!KEY || KEY.length !== 32) {
    throw new Error("BRAINBASE_ENCRYPTION_KEY not configured");
  }
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");
  return {
    ciphertext: encrypted,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

/**
 * Decrypt an encrypted field back to plaintext.
 */
export function decrypt(field: EncryptedField): string {
  if (!KEY || KEY.length !== 32) {
    throw new Error("BRAINBASE_ENCRYPTION_KEY not configured");
  }
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    KEY,
    Buffer.from(field.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(field.tag, "base64"));
  let decrypted = decipher.update(field.ciphertext, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Hash a token (invitation, API key, etc.) using SHA-256.
 * One-way — used for verification, not recovery.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Verify a token against a stored hash.
 */
export function verifyTokenHash(token: string, hash: string): boolean {
  return hashToken(token) === hash;
}

/**
 * Encrypt Supabase key for storage in brains table.
 * Returns the three columns to INSERT/UPDATE.
 */
export function encryptSupabaseKey(key: string): {
  encrypted_supabase_key: string;
  encrypted_supabase_key_iv: string;
  encrypted_supabase_key_tag: string;
} {
  const enc = encrypt(key);
  return {
    encrypted_supabase_key: enc.ciphertext,
    encrypted_supabase_key_iv: enc.iv,
    encrypted_supabase_key_tag: enc.tag,
  };
}

/**
 * Decrypt Supabase key from brains table row.
 */
export function decryptSupabaseKey(row: {
  encrypted_supabase_key: string;
  encrypted_supabase_key_iv: string;
  encrypted_supabase_key_tag: string;
}): string {
  return decrypt({
    ciphertext: row.encrypted_supabase_key,
    iv: row.encrypted_supabase_key_iv,
    tag: row.encrypted_supabase_key_tag,
  });
}
