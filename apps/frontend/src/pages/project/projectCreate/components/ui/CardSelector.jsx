import React from "react";

/**
 * CardSelector — reusable selectable card grid
 * Props:
 *  - options: Array<{ id, label, icon?, subText?, desc? }>
 *  - selectedId: string
 *  - onSelect: (id: string) => void
 *  - gridCols: string (Tailwind grid class)
 *  - compact: boolean — smaller pill-style cards
 */
export default function CardSelector({
  options,
  selectedId,
  onSelect,
  gridCols = "grid-cols-2",
  compact = false,
}) {
  return (
    <div className={`grid ${gridCols} gap-3`}>
      {options.map((opt, i) => {
        const Icon = opt.icon;
        const isSelected = selectedId === opt.id;

        if (compact) {
          return (
            <button
              key={opt.id}
              onClick={() => onSelect(opt.id)}
              style={{
                animationDelay: `${i * 60}ms`,
                background: isSelected ? "var(--accent)" : "var(--surface)",
                border: `1.5px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                color: isSelected ? "#fff" : "var(--text-secondary)",
                fontFamily: "var(--font-body)",
              }}
              className="relative flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] animate-fadeSlideUp"
            >
              {Icon && <Icon size={15} />}
              <span>{opt.label}</span>
              {isSelected && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-white/60" />
              )}
            </button>
          );
        }

        return (
          <button
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            style={{
              animationDelay: `${i * 60}ms`,
              background: isSelected ? "var(--accent-subtle)" : "var(--surface)",
              border: `1.5px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
              fontFamily: "var(--font-body)",
            }}
            className="relative flex flex-col p-5 text-left rounded-2xl transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] animate-fadeSlideUp group"
          >
            {Icon && (
              <div
                className="mb-3 p-2.5 rounded-xl inline-flex transition-all duration-200"
                style={{
                  background: isSelected ? "var(--accent)" : "var(--surface-2)",
                  color: isSelected ? "#fff" : "var(--text-muted)",
                }}
              >
                <Icon size={18} />
              </div>
            )}
            <span
              className="font-bold text-sm leading-snug"
              style={{ color: isSelected ? "var(--accent)" : "var(--text-primary)" }}
            >
              {opt.label}
            </span>
            {(opt.subText || opt.desc) && (
              <span
                className="text-xs mt-1 leading-snug"
                style={{ color: "var(--text-muted)" }}
              >
                {opt.subText || opt.desc}
              </span>
            )}
            {isSelected && (
              <div
                className="absolute top-3 right-3 w-4 h-4 rounded-full flex items-center justify-center"
                style={{ background: "var(--accent)" }}
              >
                <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                  <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}