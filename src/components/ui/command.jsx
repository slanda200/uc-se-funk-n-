import React from 'react';

export function Command({ children }) {
  return <div className="w-full">{children}</div>;
}

export function CommandInput({ value, onValueChange, placeholder }) {
  return (
    <div className="p-3 border-b">
      <input
        className="w-full outline-none text-sm"
        placeholder={placeholder}
        value={value || ''}
        onChange={(e) => onValueChange?.(e.target.value)}
      />
    </div>
  );
}

export function CommandList({ children }) {
  return <div className="max-h-72 overflow-auto">{children}</div>;
}

export function CommandEmpty({ children }) {
  // Always render; if you want conditional empty state, handle outside.
  return <div className="p-3 text-sm text-slate-500">{children}</div>;
}

export function CommandGroup({ heading, children }) {
  return (
    <div>
      {heading ? (
        <div className="px-3 pt-3 pb-1 text-xs font-medium text-slate-500">{heading}</div>
      ) : null}
      <div className="pb-2">{children}</div>
    </div>
  );
}

export function CommandItem({ children, onSelect, className = '' }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSelect?.();
      }}
      className={`px-3 py-2 hover:bg-slate-100 rounded-md mx-2 ${className}`}
    >
      {children}
    </div>
  );
}
