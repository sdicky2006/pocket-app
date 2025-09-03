import CryptoJS from "crypto-js";

export type StoredCredentials = {
  email: string;
  passwordEnc: string; // AES-encrypted password
  createdAt: number;
  expiresAt: number; // epoch ms
};

const store = new Map<string, StoredCredentials>();

function getKey(): string {
  return process.env.ENCRYPTION_KEY || "change-me-in-env";
}

function userKey(email: string): string {
  return CryptoJS.SHA256(email.toLowerCase()).toString();
}

export function encryptPlain(text: string): string {
  return CryptoJS.AES.encrypt(text, getKey()).toString();
}

export function decryptToPlain(cipher: string): string {
  const bytes = CryptoJS.AES.decrypt(cipher, getKey());
  return bytes.toString(CryptoJS.enc.Utf8);
}

export function saveCredentials(email: string, passwordPlain: string, ttlMs: number): void {
  const key = userKey(email);
  const now = Date.now();
  const rec: StoredCredentials = {
    email,
    passwordEnc: encryptPlain(passwordPlain),
    createdAt: now,
    expiresAt: now + ttlMs,
  };
  store.set(key, rec);
}

export function getCredentials(email: string): { email: string; passwordPlain: string } | null {
  const key = userKey(email);
  const rec = store.get(key);
  if (!rec) return null;
  if (Date.now() > rec.expiresAt) {
    store.delete(key);
    return null;
  }
  return {
    email: rec.email,
    passwordPlain: decryptToPlain(rec.passwordEnc),
  };
}

export function deleteCredentials(email: string): void {
  const key = userKey(email);
  store.delete(key);
}

export function clearExpired(): void {
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (now > v.expiresAt) store.delete(k);
  }
}
