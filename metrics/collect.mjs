#!/usr/bin/env node
// 両アプリ(legacy-todo-app / zero-dep-todo-app)から指標を収集し、
// metrics/history.jsonl に1行1レコードで追記する。
// GitHub Actions から毎日実行される想定。

import { execSync } from "node:child_process";
import { readdirSync, statSync, existsSync, appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const APPS = [
  { name: "legacy", dir: path.join(ROOT, "legacy-todo-app") },
  { name: "zero-dep", dir: path.join(ROOT, "zero-dep-todo-app") },
];

function sh(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
  } catch (e) {
    // npm audit は脆弱性があると非ゼロ終了するので、stdoutは取れることが多い
    return e.stdout?.toString() ?? "";
  }
}

function dirSize(dir) {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(full) : statSync(full).size;
  }
  return total;
}

function countLoc(dir) {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += countLoc(full);
    } else if (entry.name.endsWith(".ts")) {
      total += readFileSync(full, "utf-8").split("\n").length;
    }
  }
  return total;
}

function countDependencies(appDir) {
  const pkgPath = path.join(appDir, "package.json");
  if (!existsSync(pkgPath)) return { direct: 0, transitive: 0 };
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  const direct = Object.keys(pkg.dependencies ?? {}).length;

  let transitive = 0;
  const lockPath = path.join(appDir, "package-lock.json");
  if (existsSync(lockPath)) {
    const lock = JSON.parse(readFileSync(lockPath, "utf-8"));
    transitive = Object.keys(lock.packages ?? {}).length;
  }
  return { direct, transitive };
}

function npmAuditCounts(appDir) {
  if (!existsSync(path.join(appDir, "package-lock.json"))) {
    return { critical: 0, high: 0, moderate: 0, low: 0 };
  }
  const out = sh("npm audit --json", appDir);
  try {
    const json = JSON.parse(out);
    const v = json.metadata?.vulnerabilities ?? {};
    return {
      critical: v.critical ?? 0,
      high: v.high ?? 0,
      moderate: v.moderate ?? 0,
      low: v.low ?? 0,
    };
  } catch {
    return { critical: 0, high: 0, moderate: 0, low: 0 };
  }
}

function outdatedCount(appDir) {
  if (!existsSync(path.join(appDir, "node_modules"))) return 0;
  const out = sh("npm outdated --json", appDir);
  try {
    return Object.keys(JSON.parse(out || "{}")).length;
  } catch {
    return 0;
  }
}

function measureBuildTime(appDir) {
  if (!existsSync(path.join(appDir, "node_modules"))) return null;
  const start = Date.now();
  sh("npx tsc -p . --noEmit", appDir);
  return Date.now() - start;
}

const timestamp = new Date().toISOString();
const record = { timestamp, apps: {} };

for (const app of APPS) {
  const deps = countDependencies(app.dir);
  record.apps[app.name] = {
    dependencies: deps,
    vulnerabilities: npmAuditCounts(app.dir),
    outdatedPackages: outdatedCount(app.dir),
    buildTimeMs: measureBuildTime(app.dir),
    nodeModulesBytes: dirSize(path.join(app.dir, "node_modules")),
    linesOfCode: countLoc(path.join(app.dir, "src")),
  };
}

appendFileSync(path.join(__dirname, "history.jsonl"), JSON.stringify(record) + "\n");
console.log("Recorded metrics:", JSON.stringify(record, null, 2));
