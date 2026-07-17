import { createServer } from "node:http";
import process from "node:process";
import { Router, sendJson, readJsonBody, type Ctx } from "./router.js";
import { Users, Tasks } from "./db.js";
import { hashPassword, verifyPassword, signToken, verifyToken } from "./auth.js";
import { validateRegister, validateLogin, validateCreateTask, validateUpdateTask } from "./validate.js";

// dotenv の代替: Node 20.6+ 組み込みの loadEnvFile
try {
  process.loadEnvFile?.();
} catch {
  // .env が無ければ何もしない
}

const router = new Router();

router.post("/api/register", async (ctx: Ctx) => {
  const result = validateRegister(ctx.body);
  if (!result.ok) return sendJson(ctx.res, 400, { error: result.error });

  if (Users.findByEmail(result.data.email)) {
    return sendJson(ctx.res, 409, { error: "email already registered" });
  }
  const passwordHash = await hashPassword(result.data.password);
  const user = Users.create(result.data.email, passwordHash);
  sendJson(ctx.res, 201, { id: user.id, email: user.email });
});

router.post("/api/login", async (ctx: Ctx) => {
  const result = validateLogin(ctx.body);
  if (!result.ok) return sendJson(ctx.res, 400, { error: result.error });

  const user = Users.findByEmail(result.data.email);
  if (!user || !(await verifyPassword(result.data.password, user.passwordHash))) {
    return sendJson(ctx.res, 401, { error: "invalid credentials" });
  }
  sendJson(ctx.res, 200, { token: signToken(user.id) });
});

function requireAuth(ctx: Ctx): boolean {
  const header = ctx.req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) {
    sendJson(ctx.res, 401, { error: "missing token" });
    return false;
  }
  const payload = verifyToken(header.slice(7));
  if (!payload) {
    sendJson(ctx.res, 401, { error: "invalid token" });
    return false;
  }
  ctx.userId = payload.sub;
  return true;
}

router.get("/api/tasks", (ctx: Ctx) => {
  if (!requireAuth(ctx)) return;
  sendJson(ctx.res, 200, Tasks.listByUser(ctx.userId!));
});

router.post("/api/tasks", (ctx: Ctx) => {
  if (!requireAuth(ctx)) return;
  const result = validateCreateTask(ctx.body);
  if (!result.ok) return sendJson(ctx.res, 400, { error: result.error });
  const task = Tasks.create(ctx.userId!, result.data.title);
  sendJson(ctx.res, 201, task);
});

router.patch("/api/tasks/:id", (ctx: Ctx) => {
  if (!requireAuth(ctx)) return;
  const result = validateUpdateTask(ctx.body);
  if (!result.ok) return sendJson(ctx.res, 400, { error: result.error });
  const task = Tasks.update(ctx.params.id, ctx.userId!, result.data);
  if (!task) return sendJson(ctx.res, 404, { error: "not found" });
  sendJson(ctx.res, 200, task);
});

router.delete("/api/tasks/:id", (ctx: Ctx) => {
  if (!requireAuth(ctx)) return;
  const removed = Tasks.remove(ctx.params.id, ctx.userId!);
  if (!removed) return sendJson(ctx.res, 404, { error: "not found" });
  sendJson(ctx.res, 204, undefined);
});

router.get("/health", (ctx: Ctx) => sendJson(ctx.res, 200, { ok: true, variant: "zero-dep" }));

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    return sendJson(res, 204, undefined);
  }
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const match = router.match(req.method ?? "GET", url.pathname);
  if (!match) return sendJson(res, 404, { error: "not found" });

  const body = ["POST", "PATCH"].includes(req.method ?? "") ? await readJsonBody(req) : {};
  await match.handler({ req, res, params: match.params, body });
});

const PORT = process.env.PORT ?? 3002;
server.listen(PORT, () => console.log(`[zero-dep-todo-app] listening on :${PORT}`));
