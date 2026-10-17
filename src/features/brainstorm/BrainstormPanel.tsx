import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import type { Brainstorm } from "../../domain/types";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "../events/MarkdownEditor";
import { BrainstormAutosave } from "./autosave";
import { createRecoveryJournal } from "./recovery";
import "./brainstorm.css";

export interface BrainstormPanelHandle {
  flush(): Promise<void>;
}

export function BrainstormPanel({
  brainstorm,
  onSave,
  disabled = false,
  ref,
}: {
  brainstorm: Brainstorm;
  onSave: (text: string, expectedRevision: number) => Promise<Brainstorm>;
  disabled?: boolean;
  ref?: Ref<BrainstormPanelHandle>;
}) {
  const editor = useRef<MarkdownEditorHandle>(null);
  const save = useRef(onSave);
  save.current = onSave;
  const [journal] = useState(() => {
    try {
      return createRecoveryJournal(localStorage, sessionStorage);
    } catch {
      return { recover: () => undefined, write: () => {} };
    }
  });
  const [initial] = useState(() => ({
    saved: brainstorm,
    recovery: journal.recover(brainstorm),
  }));
  const [document, setDocument] = useState({
    text: initial.recovery?.text ?? brainstorm.text,
    generation: 0,
  });
  const [status, setStatus] = useState<
    "saved" | "pending" | "saving" | "error"
  >("saved");
  const [error, setError] = useState("");
  const live = useRef(true);
  const [autosave] = useState(
    () =>
      new BrainstormAutosave(
        initial.recovery?.baseline ?? initial.saved,
        () =>
          editor.current?.read() ??
          initial.recovery?.text ??
          initial.saved.text,
        (text, revision) => save.current(text, revision),
        (next, message = "") => {
          if (live.current) {
            setStatus(next);
            setError(message);
          }
        },
        journal.write,
        (next) => {
          if (live.current)
            setDocument((previous) => ({
              text: next.text,
              generation: previous.generation + 1,
            }));
        },
      ),
  );
  useImperativeHandle(ref, () => ({ flush: () => autosave.flush() }), [
    autosave,
  ]);
  useEffect(() => {
    if (initial.recovery) autosave.changed();
    return () => {
      autosave.dispose();
    };
  }, [autosave, initial]);
  useEffect(() => {
    if (autosave.receive(brainstorm))
      setDocument((previous) => ({
        text: brainstorm.text,
        generation: previous.generation + 1,
      }));
  }, [brainstorm, autosave]);
  useEffect(() => {
    live.current = true;
    const capture = () => {
      try {
        autosave.capture(
          () => editor.current?.read(true) ?? autosave.baseline.text,
        );
      } catch {
        /* An open link dialog keeps the unload warning active. */
      }
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      capture();
      if (autosave.dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("pagehide", capture);
    return () => {
      live.current = false;
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("pagehide", capture);
    };
  }, [autosave]);
  return (
    <section className="brainstorm-panel" aria-label="Brainstorm">
      <div className="brainstorm-status" role={error ? "alert" : "status"}>
        {error ? (
          <>
            {error}{" "}
            <button
              type="button"
              className="button secondary"
              disabled={disabled}
              onClick={() => {
                void autosave.flush().catch(() => {});
              }}
            >
              Retry
            </button>
          </>
        ) : status === "saving" ? (
          "Saving…"
        ) : status === "pending" ? (
          "Unsaved changes…"
        ) : (
          "Saved"
        )}
      </div>
      <MarkdownEditor
        key={document.generation}
        id="brainstorm-text"
        value={document.text}
        disabled={disabled}
        ref={editor}
        label="Brainstorm text"
        compact
        onDocumentChange={() => autosave.changed()}
      />
    </section>
  );
}
