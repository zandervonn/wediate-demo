import { useState } from "react";
import { DemoWorkspace } from "./components/DemoWorkspace";
import { LandingPage } from "./components/LandingPage";

export default function App() {
  const [view, setView] = useState<"landing" | "demo">("landing");

  if (view === "demo") {
    return <DemoWorkspace onBack={() => setView("landing")} />;
  }

  return <LandingPage onEnterLobby={() => setView("demo")} />;
}
