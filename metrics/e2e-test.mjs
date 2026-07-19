// E2Eテスト: 実際にサーバーを起動し、register→login→タスクCRUDまで
// 本物のHTTPリクエストで通しで確認する。静的チェック(npm audit / tsc)では
// 見つからない「実行時にしか分からない問題」を検出するのが狙い。
import { spawn, exec } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";

const execAsync = promisify(exec);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // まだ起動していない
    }
    await sleep(150);
  }
  throw new Error(`server did not become ready within ${timeoutMs}ms: ${url}`);
}

function readMemoryKb(pid) {
  try {
    const status = readFileSync(`/proc/${pid}/status`, "utf-8");
    const match = status.match(/VmRSS:\s+(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  } catch {
    // /proc が無い環境(Windows等)では計測不可
    return null;
  }
}

export async function runE2E(appDir, variant, port) {
  // 実データファイルが残っていると前回の結果が混ざるので、テスト前に消しておく
  for (const f of ["data.sqlite", "data.json"]) {
    const p = path.join(appDir, f);
    if (existsSync(p)) rmSync(p);
  }

  // 実際にビルド(型チェックだけでなくJSを生成)して、そのdistを起動する
  const buildStart = Date.now();
  await execAsync("npx tsc -p .", { cwd: appDir });
  const buildMs = Date.now() - buildStart;

  const bootStart = Date.now();
  const child = spawn("node", ["dist/index.js"], {
    cwd: appDir,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "ignore", "ignore"],
  });

  const base = `http://localhost:${port}`;
  let bootMs = null;
  let memoryKb = null;
  const steps = [];
  let token;

  try {
    await waitForServer(`${base}/health`, 8000);
    bootMs = Date.now() - bootStart;
    memoryKb = readMemoryKb(child.pid);

    const email = `e2e-${Date.now()}@example.com`;

    await step(steps, "register", async () => {
      const res = await fetch(`${base}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "password123" }),
      });
      if (res.status !== 201) throw new Error(`unexpected status ${res.status}`);
    });

    await step(steps, "login", async () => {
      const res = await fetch(`${base}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "password123" }),
      });
      const data = await res.json();
      if (!data.token) throw new Error("no token returned");
      token = data.token;
    });

    let taskId;
    await step(steps, "create_task", async () => {
      const res = await fetch(`${base}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: "e2e check" }),
      });
      const data = await res.json();
      if (res.status !== 201 || !data.id) throw new Error(`unexpected response ${res.status}`);
      taskId = data.id;
    });

    await step(steps, "list_tasks", async () => {
      const res = await fetch(`${base}/api/tasks`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error("task list empty or invalid");
    });

    await step(steps, "update_task", async () => {
      const res = await fetch(`${base}/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ done: true }),
      });
      const data = await res.json();
      if (res.status !== 200 || data.done !== true) throw new Error("update did not apply");
    });

    await step(steps, "delete_task", async () => {
      const res = await fetch(`${base}/api/tasks/${taskId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status !== 204) throw new Error(`unexpected status ${res.status}`);
    });
  } finally {
    child.kill();
    await sleep(200);
    for (const f of ["data.sqlite", "data.json"]) {
      const p = path.join(appDir, f);
      if (existsSync(p)) rmSync(p);
    }
  }

  const allPassed = steps.every((s) => s.ok);
  const totalStepMs = steps.reduce((sum, s) => sum + s.ms, 0);

  return { variant, buildMs, bootMs, memoryKb, steps, allPassed, avgStepMs: Math.round(totalStepMs / steps.length) };
}

async function step(steps, name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    steps.push({ name, ok: true, ms: Date.now() - t0 });
  } catch (e) {
    steps.push({ name, ok: false, ms: Date.now() - t0, error: String(e?.message ?? e) });
  }
}
