import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";
import { q, initDb } from "./db.js";
import { signToken, authMiddleware, publicUser } from "./auth.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Register
app.post("/api/auth/register", async (req, res, next) => {
  try {
    const { email, username, password } = req.body || {};
    if (!email || !username || !password)
      return res.status(400).json({ error: "email, username et password requis" });
    if (password.length < 6)
      return res.status(400).json({ error: "Mot de passe trop court (min 6)" });

    const exists = await q("SELECT id FROM users WHERE email = $1", [email]);
    if (exists.rows.length)
      return res.status(409).json({ error: "Email déjà utilisé" });

    const hash = bcrypt.hashSync(password, 10);
    const { rows } = await q(
      `INSERT INTO users (email, username, password_hash, role, display_name)
       VALUES ($1, $2, $3, 'player', $2) RETURNING *`,
      [email, username, hash]
    );
    const user = rows[0];
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

// Login
app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "email et password requis" });
    const { rows } = await q("SELECT * FROM users WHERE email = $1", [email]);
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash))
      return res.status(401).json({ error: "Identifiants invalides" });
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

// Current user (fiche perso)
app.get("/api/auth/me", authMiddleware, async (req, res, next) => {
  try {
    const { rows } = await q("SELECT * FROM users WHERE id = $1", [req.user.id]);
    if (!rows.length)
      return res.status(404).json({ error: "Utilisateur introuvable" });
    res.json({ user: publicUser(rows[0]) });
  } catch (e) {
    next(e);
  }
});

// Update profile (fiche perso)
app.put("/api/auth/me", authMiddleware, async (req, res, next) => {
  try {
    const { displayName, bio, avatar } = req.body || {};
    const { rows } = await q(
      `UPDATE users SET
         display_name = COALESCE($1, display_name),
         bio = COALESCE($2, bio),
         avatar = COALESCE($3, avatar)
       WHERE id = $4 RETURNING *`,
      [displayName ?? null, bio ?? null, avatar ?? null, req.user.id]
    );
    res.json({ user: publicUser(rows[0]) });
  } catch (e) {
    next(e);
  }
});

// Logout = client drops token.
app.post("/api/auth/logout", authMiddleware, (_req, res) => res.json({ ok: true }));

// --- Production: servir le front buildé (service unique, une seule URL) ---
const clientDist = join(__dirname, "..", "..", "client", "dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(join(clientDist, "index.html")));
}

const PORT = process.env.PORT || 4000;
initDb()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () =>
      console.log(`API sur http://0.0.0.0:${PORT}`)
    );
  })
  .catch((e) => {
    console.error("Échec init DB:", e);
    process.exit(1);
  });
