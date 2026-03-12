import { useState } from 'react';
import Landing from './components/Landing.jsx';
import Herbarium from './components/Herbarium.jsx';
import AdminPanel from './components/AdminPanel.jsx';

export default function App() {
  const [phase, setPhase]   = useState("landing"); // "landing" | "leaving" | "herbarium" | "admin"
  const [panel, setPanel]   = useState(null);       // "about" | "contact" | null
  const [skipped, setSkipped] = useState(false);

  function enter() {
    setPhase("leaving");
    setTimeout(() => setPhase("herbarium"), 1000);
  }

  if (phase === "admin") {
    return <AdminPanel onBack={() => setPhase("herbarium")} />;
  }

  if (phase === "herbarium") {
    return <Herbarium onBack={() => setPhase("landing")} onAdmin={() => setPhase("admin")} />;
  }

  return (
    <>
      <Landing
        skipped={skipped}
        onSkip={() => setSkipped(true)}
        onEnter={enter}
        panel={panel}
        onPanel={setPanel}
      />
      <div className={`overlay${phase === "leaving" ? " on" : ""}`} />
    </>
  );
}
