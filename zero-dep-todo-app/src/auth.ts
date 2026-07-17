// bcrypt / jsonwebtoken の代替を node:crypto のみで実装
import { scrypt, randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const SECRET = process.env.AUTH_SECRET ?? "dev-secret-change-me";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7日 (jsonwebtokenの expiresIn: "7d" 相当)

// --- パスワードハッシュ (bcryptの代替: scrypt + salt) ---
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

// --- 署名付きトークン (jsonwebtokenの代替: HMAC-SHA256による自作JWT風トークン) ---
function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function signToken(userId: string): string {
  const payload = { sub: userId, exp: Date.now() + TOKEN_TTL_MS };
  const body = base64url(JSON.stringify(payload));
  const sig = createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken(token: string): { sub: string } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expectedSig = createHmac("sha256", SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as { sub: string; exp: number };
    if (Date.now() > payload.exp) return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}
