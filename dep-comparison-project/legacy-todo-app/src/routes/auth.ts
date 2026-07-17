import { Router } from "express";
import { randomUUID } from "node:crypto";
import db from "../db.js";
import { hashPassword, verifyPassword, signToken } from "../auth.js";
import { registerSchema, loginSchema } from "../validation.js";

const router = Router();

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { email, password } = parsed.data;

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    res.status(409).json({ error: "email already registered" });
    return;
  }

  const id = randomUUID();
  const passwordHash = await hashPassword(password);
  db.prepare("INSERT INTO users (id, email, passwordHash) VALUES (?, ?, ?)").run(id, email, passwordHash);

  res.status(201).json({ id, email });
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { email, password } = parsed.data;

  const user = db.prepare("SELECT id, passwordHash FROM users WHERE email = ?").get(email) as
    | { id: string; passwordHash: string }
    | undefined;

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: "invalid credentials" });
    return;
  }

  res.status(200).json({ token: signToken(user.id) });
});

export default router;
