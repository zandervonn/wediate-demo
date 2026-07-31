import { SessionPage } from "./components/SessionPage";
import { TopBar } from "./components/TopBar";
import { PUBLIC_PREVIEW_LABEL, PUBLIC_PREVIEW_NOTICE } from "./mockMode";

export default function App() {
  return (
    <>
      <TopBar />
      <div className="public-demo-banner" role="status">
        <strong>{PUBLIC_PREVIEW_LABEL}</strong>
        <span>{PUBLIC_PREVIEW_NOTICE}</span>
      </div>
      <SessionPage />
    </>
  );
}
