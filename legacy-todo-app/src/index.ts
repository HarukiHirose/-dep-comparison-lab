import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import taskRoutes from "./routes/tasks.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", authRoutes);
app.use("/api/tasks", taskRoutes);

app.get("/health", (_req, res) => res.json({ ok: true, variant: "legacy" }));

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`[legacy-todo-app] listening on :${PORT}`));
