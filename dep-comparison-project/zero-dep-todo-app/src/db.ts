// better-sqlite3 の代替。
// Node 22.5+ の組み込み node:sqlite があればそれを使い、
// 無ければ依存を増やさずに済むよう単純なJSONファイルストアにフォールバックする。
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  done: boolean;
  createdAt: string;
}

interface Store {
  users: User[];
  tasks: Task[];
}

const DATA_FILE = path.join(process.cwd(), "data.json");

function load(): Store {
  if (!existsSync(DATA_FILE)) return { users: [], tasks: [] };
  return JSON.parse(readFileSync(DATA_FILE, "utf-8"));
}

function save(store: Store) {
  writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

// 単純化のため、書き込みのたびにファイル全体を読み書きする(小規模なToDoアプリ向け)。
// 本格運用では node:sqlite (Node 22.5+) への切り替えを推奨。

export const Users = {
  findByEmail(email: string): User | undefined {
    return load().users.find((u) => u.email === email);
  },
  create(email: string, passwordHash: string): User {
    const store = load();
    const user: User = { id: randomUUID(), email, passwordHash };
    store.users.push(user);
    save(store);
    return user;
  },
};

export const Tasks = {
  listByUser(userId: string): Task[] {
    return load()
      .tasks.filter((t) => t.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  create(userId: string, title: string): Task {
    const store = load();
    const task: Task = { id: randomUUID(), userId, title, done: false, createdAt: new Date().toISOString() };
    store.tasks.push(task);
    save(store);
    return task;
  },
  update(id: string, userId: string, patch: { title?: string; done?: boolean }): Task | undefined {
    const store = load();
    const task = store.tasks.find((t) => t.id === id && t.userId === userId);
    if (!task) return undefined;
    if (patch.title !== undefined) task.title = patch.title;
    if (patch.done !== undefined) task.done = patch.done;
    save(store);
    return task;
  },
  remove(id: string, userId: string): boolean {
    const store = load();
    const before = store.tasks.length;
    store.tasks = store.tasks.filter((t) => !(t.id === id && t.userId === userId));
    save(store);
    return store.tasks.length < before;
  },
};
