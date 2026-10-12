import { createRoot } from "react-dom/client";
import { App } from "./adapters/inbound/react/App";
import { StudyService } from "./core/application/study-service";
import {
  BrowserDownload,
  BrowserStudyRepository,
} from "./adapters/outbound/browser/browser";
import "./style.css";
const service = new StudyService(
  new BrowserStudyRepository(),
  new BrowserDownload(),
  { now: () => new Date().toISOString() },
  { next: () => crypto.randomUUID() },
);
createRoot(document.getElementById("root")!).render(<App service={service} />);
