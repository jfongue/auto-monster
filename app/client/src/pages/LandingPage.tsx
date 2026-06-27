import { useNavigate } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();
  return (
    <div className="center-screen">
      <div className="landing">
        <div className="logo big">⚔️ AutoMonster</div>
        <div className="wip-badge">🚧 Work in progress</div>
        <p className="tagline">
          Un deck-builder avec exploration et combats automatiques.
          <br />
          Le jeu est en cours de construction.
        </p>
        <button className="btn-primary" onClick={() => navigate("/login")}>
          Se connecter
        </button>
      </div>
    </div>
  );
}
