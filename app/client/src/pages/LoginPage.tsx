import { FormEvent, useState } from "react";
import { useAuth } from "../lib/auth";

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function onDemo() {
    setError("");
    setBusy(true);
    try {
      await login("admin", "admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="card auth-card" onSubmit={onSubmit}>
        <div className="logo">⚔️ Auto Battler</div>
        <h1>{mode === "login" ? "Connexion" : "Créer un compte"}</h1>

        <label>
          Email
          <input
            type="text"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        {mode === "register" && (
          <label>
            Pseudo
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
        )}

        <label>
          Mot de passe
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
        </label>

        {error && <div className="error">{error}</div>}

        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "..." : mode === "login" ? "Se connecter" : "S'inscrire"}
        </button>

        {mode === "login" && (
          <button
            type="button"
            disabled={busy}
            className="btn-secondary"
            onClick={onDemo}
          >
            🎮 Essayer le compte test
          </button>
        )}

        <button
          type="button"
          className="link"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
          }}
        >
          {mode === "login"
            ? "Pas de compte ? Créer un compte"
            : "Déjà un compte ? Se connecter"}
        </button>
      </form>
    </div>
  );
}
