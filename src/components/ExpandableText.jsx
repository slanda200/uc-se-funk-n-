import React from "react";

export default function ExpandableText({ text = "", maxChars = 520 }) {
  const [expanded, setExpanded] = React.useState(false);

  if (!text) return null;

  const needsToggle = text.length > maxChars;
  const visibleText =
    expanded || !needsToggle ? text : text.slice(0, maxChars).trimEnd() + "…";

  return (
    <div>
      <div className="whitespace-pre-line">
        {visibleText}
      </div>

      {needsToggle && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="
              inline-flex items-center justify-center
              px-4 py-2
              rounded-full
              border-2 border-slate-300
              bg-white
              text-slate-800
              font-semibold
              shadow-sm
              hover:shadow-md
              hover:border-slate-400
              active:scale-[0.98]
              transition
            "
          >
            {expanded ? "Skrýt" : "Zobrazit vše"}
          </button>
        </div>
      )}
    </div>
  );
}
