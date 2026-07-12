import { useRef, type KeyboardEvent } from "react";

const colors = [
  ["blue", "Blue"],
  ["violet", "Violet"],
  ["teal", "Teal"],
  ["amber", "Amber"],
  ["rose", "Rose"],
  ["slate", "Slate"],
] as const;

export function InitialsColorPicker({ value, onChange, disabled = false }: { readonly value: string; readonly onChange: (value: string) => void; readonly disabled?: boolean }) {
  const groupRef = useRef<HTMLDivElement>(null);

  function move(event: KeyboardEvent<HTMLButtonElement>, direction: number) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const current = colors.findIndex(([color]) => color === value);
    const next = (current + direction + colors.length) % colors.length;
    onChange(colors[next][0]);
    groupRef.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
  }

  return (
    <fieldset className="initials-color-field" disabled={disabled}>
      <legend>Initials color</legend>
      <div ref={groupRef} className="initials-color-picker" role="radiogroup" aria-label="Initials color">
        {colors.map(([color, label]) => (
          <button
            key={color}
            type="button"
            className={`initials-color-swatch guest-avatar--${color}${value === color ? ' is-selected' : ''}`}
            role="radio"
            aria-checked={value === color}
            aria-label={label}
            title={label}
            tabIndex={value === color ? 0 : -1}
            onClick={() => onChange(color)}
            onKeyDown={(event) => move(event, event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1)}
          >
            <span aria-hidden="true">{value === color ? '✓' : ''}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
