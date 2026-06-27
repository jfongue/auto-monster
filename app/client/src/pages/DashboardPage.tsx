import { FormEvent, useState } from "react";
import { useAuth } from "../lib/auth";

export default function DashboardPage() {
  const { user, logout, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateProfile({ displayName, bio });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  const initial = (user.displayName || user.username || "?")
    .charAt(0)
    .toUpperCase();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="logo">⚔️ AutoMonster</div>
        <button className="btn-ghost" onClick={() => logout()}>
          Déconnexion
        </button>
      </header>

      <main className="content">
        {/* Fiche perso */}
        <section className="card profile-card">
          <div className="profile-head">
            <div className="avatar">{initial}</div>
            <div>
              <h2>{user.displayName || user.username}</h2>
              <div className="muted">{user.email}</div>
              <span className={`badge ${user.role}`}>{user.role}</span>
            </div>
          </div>

          {!editing ? (
            <>
              <p className="bio">{user.bio || "Aucune bio pour le moment."}</p>
              <button className="btn-secondary" onClick={() => setEditing(true)}>
                Modifier la fiche
              </button>
            </>
          ) : (
            <form onSubmit={onSave} className="profile-form">
              <label>
                Nom affiché
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </label>
              <label>
                Bio
                <textarea
                  value={bio}
                  rows={3}
                  onChange={(e) => setBio(e.target.value)}
                />
              </label>
              <div className="row">
                <button className="btn-primary" disabled={busy} type="submit">
                  Enregistrer
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setEditing(false)}
                >
                  Annuler
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Zone de jeu (vierge pour l'instant) */}
        <section className="card empty-state">
          <h3>🗺️ Carte du monde</h3>
          <p className="muted">
            Projet vierge — le contenu du jeu (exploration, combats auto, deck)
            viendra ici.
          </p>
        </section>
      </main>
    </div>
  );
}
