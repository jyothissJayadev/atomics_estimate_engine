import React from "react";

/**
 * StepContainer — cinematic step wrapper with staggered reveal
 */
export default function StepContainer({ title, subtext, eyebrow, children }) {
  return (
    <div className="flex flex-col gap-10">
      <div className="space-y-3">
        {eyebrow && (
          <div className="flex items-center gap-2">
            <span
              className="inline-block text-[10px] font-black tracking-[0.25em] uppercase"
              style={{ color: "var(--accent)" }}
            >
              {eyebrow}
            </span>
          </div>
        )}
        <h2
          className="font-black leading-[1.1] tracking-tight"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
            color: "var(--text-primary)",
          }}
        >
          {title}
        </h2>
        {subtext && (
          <p
            className="text-base leading-relaxed max-w-md"
            style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}
          >
            {subtext}
          </p>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}
