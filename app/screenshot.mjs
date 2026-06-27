// Capture headless de l'état de l'app (login + dashboard connecté).
// Usage: node screenshot.mjs   (serveurs client+server doivent tourner)
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const EMAIL = process.env.ADMIN_EMAIL || "admin@autobattler.local";
const PASSWORD = process.env.ADMIN_PASSWORD || "admin1234";
const OUT = ".screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ["--no-sandbox", "--use-gl=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 420, height: 880 } });

// 1. Écran de connexion
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}/01-login.png` });

// 2. Connexion admin
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForSelector("text=Déconnexion", { timeout: 5000 });
await page.screenshot({ path: `${OUT}/02-dashboard.png` });

console.log("Screenshots écrits dans", OUT);
await browser.close();
