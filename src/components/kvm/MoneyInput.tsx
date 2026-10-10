import { useState } from "react";
import { Input } from "@/components/ui/input";
import { toPaise, toRupees } from "@/lib/money";

/**
 * A money field controlled by its paise value, displayed in rupees. While
 * the field has focus it shows exactly what was typed instead of the
 * rounded-and-reconverted value - otherwise typing a decimal character by
 * character gets the "." rounded away on every keystroke, and since the
 * field would then be re-parsing its own (wrong) displayed text as fresh
 * input, backspacing or typing another digit makes the number balloon
 * instead of shrink or correct itself.
 */
export function MoneyInput({
  valuePaise,
  onChange,
  className,
  placeholder,
}: {
  valuePaise: number | undefined;
  onChange: (paise: number) => void;
  className?: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      className={className}
      placeholder={placeholder}
      value={draft ?? (valuePaise ? String(toRupees(valuePaise)) : "")}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(toPaise(e.target.value));
      }}
      onFocus={(e) => e.target.select()}
      onBlur={() => setDraft(null)}
    />
  );
}
