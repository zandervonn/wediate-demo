import { SessionPage } from "./components/SessionPage";
import { TopBar } from "./components/TopBar";
import { MOCK_MODE_LABEL, MOCK_MODE_NOTICE } from "./mockMode";

export default function App() {
  return (
    <>
      <TopBar />
      <div className="public-demo-banner" role="status">
        <strong>{MOCK_MODE_LABEL}</strong>
        <span>{MOCK_MODE_NOTICE}</span>
      </div>
      <SessionPage />
    </>
  );
}
