import { Router } from "express";
import { randomUUID } from "node:crypto";
import db from "../db.js";
import { requireAuth, type AuthedRequest } from "../auth.js";
import { createTaskSchema, updateTaskSchema } from "../validation.js";

const router = Router();
router.use(requireAuth);

router.get("/", (req: AuthedRequest, res) => {
  const tasks = db.prepare("SELECT * FROM tasks WHERE userId = ? ORDER BY createdAt DESC").all(req.userId);
  res.json(tasks.map((t: any) => ({ ...t, done: Boolean(t.done) })));
});

router.post("/", (req: AuthedRequest, res) => {
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare("INSERT INTO tasks (id, userId, title, done, createdAt) VALUES (?, ?, ?, 0, ?)").run(
    id,
    req.userId,
    parsed.data.title,
    createdAt
  );
  res.status(201).json({ id, title: parsed.data.title, done: false, createdAt });
});

router.patch("/:id", (req: AuthedRequest, res) => {
  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const existing = db
    .prepare("SELECT * FROM tasks WHERE id = ? AND userId = ?")
    .get(req.params.id, req.userId) as any;
  if (!existing) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const title = parsed.data.title ?? existing.title;
  const done = parsed.data.done ?? Boolean(existing.done);
  db.prepare("UPDATE tasks SET title = ?, done = ? WHERE id = ?").run(title, done ? 1 : 0, req.params.id);
  res.json({ ...existing, title, done });
});

router.delete("/:id", (req: AuthedRequest, res) => {
  const result = db.prepare("DELETE FROM tasks WHERE id = ? AND userId = ?").run(req.params.id, req.userId);
  if (result.changes === 0) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.status(204).send();
});

export default router;
