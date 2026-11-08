"use client";

import {
  Children,
  ReactNode,
  forwardRef,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, ChevronDown } from "lucide-react";

type SelectChangeEvent = { target: { name: string; value: string }; currentTarget: { name: string; value: string } };

type SelectProps = {
  value?: string;
  onChange?: (event: SelectChangeEvent) => void;
  onBlur?: () => void;
  name?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  wrapperClassName?: string;
  "aria-label"?: string;
  /** `<option value="…">Label</option>` elements, same as a native select. */
  children?: ReactNode;
};

type Option = { value: string; label: string; disabled: boolean };

function parseOptions(children: ReactNode): Option[] {
  const options: Option[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>(child)) return;
    const { value, disabled, children: label } = child.props;
    const text = Children.toArray(label).join("");
    options.push({ value: String(value ?? text), label: text, disabled: !!disabled });
  });
  return options;
}

/**
 * Custom select with a fixed-height, scrollable dropdown (native selects
 * expand to the full list length, which gets unwieldy for long lists).
 * Drop-in for the native API: takes <option> children and calls
 * `onChange` with an event-like `{ target: { value, name } }`.
 * Callers still control border/background/shape via `className`.
 */
export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  (
    { value = "", onChange, onBlur, name, id, disabled, className = "", wrapperClassName = "", children, ...rest },
    ref
  ) => {
    const options = useMemo(() => parseOptions(children), [children]);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const listId = useId();

    const selectedIndex = options.findIndex((o) => o.value === value);
    const selected = options[selectedIndex];

    function openList() {
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : options.findIndex((o) => !o.disabled));
      setOpen(true);
    }

    function choose(option: Option) {
      if (option.disabled) return;
      const target = { name: name ?? "", value: option.value };
      onChange?.({ target, currentTarget: target });
      setOpen(false);
    }

    function move(step: 1 | -1) {
      let i = activeIndex;
      for (let n = 0; n < options.length; n++) {
        i = (i + step + options.length) % options.length;
        if (!options[i].disabled) {
          setActiveIndex(i);
          return;
        }
      }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
      if (disabled) return;
      switch (e.key) {
        case "ArrowDown":
        case "ArrowUp":
          e.preventDefault();
          if (!open) openList();
          else move(e.key === "ArrowDown" ? 1 : -1);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (!open) openList();
          else if (options[activeIndex]) choose(options[activeIndex]);
          break;
        case "Escape":
          if (open) {
            e.preventDefault();
            setOpen(false);
          }
          break;
        case "Tab":
          setOpen(false);
          break;
        default:
          // Type-ahead: jump to the next option starting with the typed letter.
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const letter = e.key.toLowerCase();
            const start = open ? activeIndex : selectedIndex;
            for (let n = 1; n <= options.length; n++) {
              const i = (start + n + options.length) % options.length;
              if (!options[i].disabled && options[i].label.toLowerCase().startsWith(letter)) {
                if (!open) setOpen(true);
                setActiveIndex(i);
                break;
              }
            }
          }
      }
    }

    // Close on outside click.
    useEffect(() => {
      if (!open) return;
      function onPointerDown(e: PointerEvent) {
        if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
      }
      document.addEventListener("pointerdown", onPointerDown);
      return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [open]);

    // Keep the highlighted option visible while navigating with the keyboard.
    useEffect(() => {
      if (!open || activeIndex < 0) return;
      listRef.current?.children[activeIndex]?.scrollIntoView?.({ block: "nearest" });
    }, [open, activeIndex]);

    return (
      <div ref={wrapperRef} className={`relative ${wrapperClassName}`}>
        <button
          ref={ref}
          type="button"
          id={id}
          disabled={disabled}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={rest["aria-label"]}
          onClick={() => (open ? setOpen(false) : openList())}
          onKeyDown={handleKeyDown}
          onBlur={onBlur}
          className={`w-full pr-10 text-left disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
        >
          <span className="block truncate">{selected?.label ?? ""}</span>
        </button>
        <ChevronDown
          size={16}
          className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-charcoal/40 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
        {open && (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto overscroll-contain rounded-2xl border border-maroon/15 bg-white py-1 shadow-lg"
          >
            {options.map((option, i) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                aria-disabled={option.disabled || undefined}
                // preventDefault keeps focus on the trigger button.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(option)}
                onMouseEnter={() => !option.disabled && setActiveIndex(i)}
                className={`flex cursor-pointer items-center justify-between gap-2 px-4 py-2 text-sm ${
                  i === activeIndex ? "bg-terracotta/10 text-maroon" : "text-charcoal"
                } ${option.value === value ? "font-semibold" : ""} ${option.disabled ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <span className="truncate">{option.label}</span>
                {option.value === value && <Check size={14} className="shrink-0 text-terracotta" />}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";
