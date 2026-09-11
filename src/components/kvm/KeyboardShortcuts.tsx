import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/** True while focus is on something that eats printable keys like "?" as text. */
export function isTypingTarget(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
}

const ShortcutsContext = createContext<() => void>(() => {});
/** Opens the global keyboard-shortcuts help dialog from anywhere in the app. */
export const useOpenShortcuts = () => useContext(ShortcutsContext);

const NAV_KEYS: [string, string][] = [
  ["F1", "Home"],
  ["F2", "Billing"],
  ["F3", "Products"],
  ["F4", "Stock"],
];

const BILLING_KEYS: [string, string][] = [
  ["Type + Enter", "Search a product and add the highlighted result"],
  ["3 * item", "Add 3 of that item in one go (qty * search)"],
  ["↑ / ↓", "Move through search results, customer matches, or cart rows"],
  ["Esc", "Jump back to the product search box from anywhere"],
  ["Tab", "Move to the next box, including Qty → Rate → Discount → Delete"],
  ["F5", "Jump to / change the customer"],
  ["F6", "Hold this bill"],
  ["F7", "Clear this bill and start over"],
  ["F8", "Save only"],
  ["F9", "Save and print"],
  ["Alt+1 / 2 / 3", "Fill payment as full cash / UPI / credit"],
  ["Enter", "In a payment box, saves once the amounts match the total"],
];

/**
 * Provides the "?" hotkey (ignored while typing) and mounts the shortcuts
 * dialog once for the whole app, so any screen can open it via context.
 */
export function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !isTypingTarget(e.target)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ShortcutsContext.Provider value={() => setOpen(true)}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-4 w-4" /> Keyboard shortcuts
            </DialogTitle>
            <DialogDescription>
              Press <span className="kbd-hint">?</span> any time to open this again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Go to a screen
              </div>
              <ShortcutRows rows={NAV_KEYS} />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Billing — start to print, no mouse needed
              </div>
              <ShortcutRows rows={BILLING_KEYS} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ShortcutsContext.Provider>
  );
}

function ShortcutRows({ rows }: { rows: [string, string][] }) {
  return (
    <div className="space-y-1.5">
      {rows.map(([key, desc]) => (
        <div key={key} className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{desc}</span>
          <span className="kbd-hint shrink-0">{key}</span>
        </div>
      ))}
    </div>
  );
}
