import logo from "../ui/logo.png";
import {
  CalendarDays,
  CheckSquare,
  ClipboardList,
  LayoutDashboard,
  Lightbulb,
  NotebookPen,
  Search,
  Settings,
} from "lucide-react";
import { syncSummary } from "../features/settings/SyncSettings";
import { isDesktop } from "../platform/desktop";
import type { SyncState } from "../sync/useSync";
import { navigationViews, type View } from "./types";

const icons = [
  LayoutDashboard,
  ClipboardList,
  CheckSquare,
  CalendarDays,
  NotebookPen,
  Lightbulb,
  Settings,
];

export function Sidebar({
  current,
  projectCount,
  syncState,
  replaced,
  onNavigate,
  onSearch,
  onShowTrash,
}: {
  /** The highlighted entry (Settings while the settings page is open). */
  current: View;
  projectCount: number;
  syncState: SyncState;
  /** Local versions replaced by another computer and still in the trash. */
  replaced: number;
  onNavigate: (view: View) => void;
  onSearch: () => void;
  onShowTrash: () => void;
}) {
  return (
    <aside className="sidebar">
      <a
        className="brand"
        aria-label="Plan B — Dashboard"
        title="Plan B — Dashboard"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          onNavigate("Dashboard");
        }}
      >
        <span className="brand-mark">
          <img src={logo} alt="" />
        </span>
        <span className="brand-label">
          Plan B<small>Personal workspace</small>
        </span>
      </a>
      <button
        type="button"
        className="search-button"
        aria-label="Search"
        title="Search (Ctrl+K)"
        onClick={onSearch}
      >
        <Search size={16} aria-hidden="true" />
        <span className="nav-text">Search</span>
        <kbd className="nav-text">Ctrl+K</kbd>
      </button>
      <nav aria-label="Main navigation">
        {navigationViews.map((v, i) => {
          const Icon = icons[i];
          return (
            <button
              key={v}
              aria-label={v}
              title={v}
              aria-current={current === v ? "page" : undefined}
              className={`nav-button ${v === "Settings" ? "settings-nav" : ""} ${current === v ? "active" : ""}`}
              data-kind={v.toLowerCase()}
              onClick={() => onNavigate(v)}
            >
              <Icon size={18} aria-hidden="true" />
              <span className="nav-text">{v}</span>
              {v === "Projects" && <small>{projectCount}</small>}
            </button>
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <span className="storage-label">
          <span className="local-dot" />{" "}
          {syncSummary(syncState) || "Stored locally"}
        </span>
        {replaced > 0 && (
          <button
            className="link-button sync-conflict-note"
            onClick={onShowTrash}
          >
            {replaced === 1
              ? "Changed on another computer – your version is in the trash"
              : `${replaced} items changed on another computer – your versions are in the trash`}
          </button>
        )}
        <small>
          {isDesktop()
            ? "Your data stays on this computer."
            : "Your data stays in this browser."}
        </small>
      </div>
    </aside>
  );
}
