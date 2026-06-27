import bcrypt from "bcryptjs";

// DB layer Postgres (pg). En local sans DATABASE_URL, on utilise pg-mem
// (Postgres en mémoire) pour pouvoir lancer/tester sans installer Postgres.
const url = process.env.DATABASE_URL || "memory://local";
const useMemory = url.startsWith("memory");

let Pool;
if (useMemory) {
  const { newDb } = await import("pg-mem");
  Pool = newDb().adapters.createPg().Pool;
} else {
  const pg = (await import("pg")).default;
  Pool = pg.Pool;
}

export const pool = useMemory
  ? new Pool()
  : new Pool({
      connectionString: url,
      // Neon et la plupart des Postgres managés exigent SSL.
      ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
    });

export const q = (text, params) => pool.query(text, params);

export async function initDb() {
  await q(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'player',
      display_name TEXT,
      avatar TEXT,
      bio TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await seedAdmin();
}

export async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || "admin@autobattler.local";
  const password = process.env.ADMIN_PASSWORD || "admin1234";
  const username = process.env.ADMIN_USERNAME || "admin";

  const { rows } = await q("SELECT id FROM users WHERE email = $1", [email]);
  if (rows.length) {
    console.log(`Admin déjà présent: ${email}`);
    return;
  }
  const hash = bcrypt.hashSync(password, 10);
  await q(
    `INSERT INTO users (email, username, password_hash, role, display_name, bio)
     VALUES ($1, $2, $3, 'admin', 'Administrateur', 'Compte admin par défaut.')`,
    [email, username, hash]
  );
  console.log(`Admin créé:\n  email: ${email}\n  mot de passe: ${password}`);
}
