// zod の代替: 必要最小限のバリデーションを自作
export type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegister(body: any): ValidationResult<{ email: string; password: string }> {
  if (typeof body?.email !== "string" || !EMAIL_RE.test(body.email)) {
    return { ok: false, error: "invalid email" };
  }
  if (typeof body?.password !== "string" || body.password.length < 8) {
    return { ok: false, error: "password must be at least 8 characters" };
  }
  return { ok: true, data: { email: body.email, password: body.password } };
}

export function validateLogin(body: any): ValidationResult<{ email: string; password: string }> {
  if (typeof body?.email !== "string" || !EMAIL_RE.test(body.email)) {
    return { ok: false, error: "invalid email" };
  }
  if (typeof body?.password !== "string") {
    return { ok: false, error: "password required" };
  }
  return { ok: true, data: { email: body.email, password: body.password } };
}

export function validateCreateTask(body: any): ValidationResult<{ title: string }> {
  if (typeof body?.title !== "string" || body.title.length < 1 || body.title.length > 200) {
    return { ok: false, error: "title must be 1-200 characters" };
  }
  return { ok: true, data: { title: body.title } };
}

export function validateUpdateTask(body: any): ValidationResult<{ title?: string; done?: boolean }> {
  const result: { title?: string; done?: boolean } = {};
  if (body?.title !== undefined) {
    if (typeof body.title !== "string" || body.title.length < 1 || body.title.length > 200) {
      return { ok: false, error: "title must be 1-200 characters" };
    }
    result.title = body.title;
  }
  if (body?.done !== undefined) {
    if (typeof body.done !== "boolean") {
      return { ok: false, error: "done must be boolean" };
    }
    result.done = body.done;
  }
  return { ok: true, data: result };
}
