// express の代替: node:http の上に最小限のルーター/JSONハンドリングを自作
import type { IncomingMessage, ServerResponse } from "node:http";

export interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  params: Record<string, string>;
  body: any;
  userId?: string;
}

type Handler = (ctx: Ctx) => void | Promise<void>;

interface Route {
  method: string;
  segments: string[]; // e.g. ["api", "tasks", ":id"]
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  add(method: string, pattern: string, handler: Handler) {
    this.routes.push({ method, segments: pattern.split("/").filter(Boolean), handler });
  }
  get(pattern: string, handler: Handler) {
    this.add("GET", pattern, handler);
  }
  post(pattern: string, handler: Handler) {
    this.add("POST", pattern, handler);
  }
  patch(pattern: string, handler: Handler) {
    this.add("PATCH", pattern, handler);
  }
  delete(pattern: string, handler: Handler) {
    this.add("DELETE", pattern, handler);
  }

  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | null {
    const segments = pathname.split("/").filter(Boolean);
    for (const route of this.routes) {
      if (route.method !== method) continue;
      if (route.segments.length !== segments.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < route.segments.length; i++) {
        const routeSeg = route.segments[i];
        if (routeSeg.startsWith(":")) {
          params[routeSeg.slice(1)] = segments[i];
        } else if (routeSeg !== segments[i]) {
          ok = false;
          break;
        }
      }
      if (ok) return { handler: route.handler, params };
    }
    return null;
  }
}

export function sendJson(res: ServerResponse, status: number, data: unknown) {
  const body = data === undefined ? "" : JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*", // cors パッケージの代替 (最小限)
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  });
  res.end(body);
}

export async function readJsonBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch {
    return {};
  }
}
