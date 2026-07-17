import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  done: z.boolean().optional(),
});
