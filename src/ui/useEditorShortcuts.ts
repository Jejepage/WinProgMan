import { useEffect, useRef, type RefObject } from "react";
import { confirmAction } from "../platform/desktop";

/**
 * Keyboard shortcuts for an open editor form: Ctrl+S saves, Escape cancels.
 * Escape asks before discarding changes when `isDirty` reports any.
 */
export function useEditorShortcuts(
  form: RefObject<HTMLFormElement | null>,
  {
    active = true,
    isDirty,
    onCancel,
  }: {
    active?: boolean;
    isDirty: () => boolean;
    onCancel: () => void;
  },
) {
  // Latest callbacks without re-registering the listener on every render.
  const latest = useRef({ isDirty, onCancel });
  latest.current = { isDirty, onCancel };
  useEffect(() => {
    if (!active) return;
    let asking = false;
    const onKey = (event: KeyboardEvent) => {
      const element = form.current;
      if (!element || element.closest("[hidden]") || event.defaultPrevented)
        return;
      // Dialogs (search, shortcut help) handle their own keys.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        element.requestSubmit();
        return;
      }
      if (event.key !== "Escape" || asking) return;
      // A native <select> or date picker closes itself first.
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".milkdown-menu, .milkdown-slash-menu")) return;
      event.preventDefault();
      if (!latest.current.isDirty()) {
        latest.current.onCancel();
        return;
      }
      asking = true;
      void confirmAction("Discard unsaved changes?").then((discard) => {
        asking = false;
        if (discard) latest.current.onCancel();
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, form]);
}
