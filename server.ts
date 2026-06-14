import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;
const DB_PATH = path.join(process.cwd(), "portfolio_db.json");

app.use(express.json());

// Helper to read database state
const INITIAL_STATE = {
  onExchange: { principal: 10000, currentValue: 12000 },
  offExchange: { principal: 20000, currentValue: 21000 },
  targetAmount: 100000,
  history: []
};

function readDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error reading database file, returning default state", error);
  }
  return INITIAL_STATE;
}

// Helper to write database state
function writeDB(state: any) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing database file", error);
  }
}

// Ensure database file exists on startup
if (!fs.existsSync(DB_PATH)) {
  writeDB(INITIAL_STATE);
}

// API Routes

// 1. Get Portfolio Data (Read-only API, public for easy dashboard load on multiple devices)
app.get("/api/portfolio", (req, res) => {
  res.json(readDB());
});

// 2. Verify Password Endpoint
app.post("/api/verify-password", (req, res) => {
  const { password } = req.body;
  const correctPassword = process.env.EDIT_PASSWORD || "nasdaqpassword";
  
  if (password === correctPassword) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: "密码错误，请重试！" });
  }
});

// 3. Update Portfolio Data (Protected API)
app.post("/api/portfolio", (req, res) => {
  const passwordHeader = req.headers["x-edit-password"];
  const correctPassword = process.env.EDIT_PASSWORD || "nasdaqpassword";

  if (passwordHeader !== correctPassword) {
    res.status(401).json({ error: "Unauthorized: Invalid password" });
    return;
  }

  const newState = req.body;
  if (!newState || typeof newState !== "object") {
    res.status(400).json({ error: "Invalid payload state" });
    return;
  }

  // Preserve history if missing or perform light sanitization
  const currentDB = readDB();
  const stateToSave = {
    onExchange: newState.onExchange || currentDB.onExchange,
    offExchange: newState.offExchange || currentDB.offExchange,
    targetAmount: typeof newState.targetAmount === "number" ? newState.targetAmount : currentDB.targetAmount,
    history: Array.isArray(newState.history) ? newState.history : currentDB.history
  };

  writeDB(stateToSave);
  res.json({ success: true, data: stateToSave });
});

// Setup Vite & Static Assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[NASDAQ server] Running in fullstack on port http://localhost:${PORT}`);
  });
}

startServer();
