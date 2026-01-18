import React, { createContext, useContext } from 'react';

const PopoverCtx = createContext(null);

export function Popover({ open, onOpenChange, children }) {
  return (
    <PopoverCtx.Provider value={{ open: !!open, onOpenChange }}>
      {children}
    </PopoverCtx.Provider>
  );
}

export function PopoverTrigger({ asChild, children }) {
  const ctx = useContext(PopoverCtx);
  const toggle = () => ctx?.onOpenChange?.(!ctx.open);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: (e) => {
        children.props.onClick?.(e);
        toggle();
      },
    });
  }

  return (
    <button onClick={toggle} type="button">
      {children}
    </button>
  );
}

export function PopoverContent({ className = '', children }) {
  const ctx = useContext(PopoverCtx);
  if (!ctx?.open) return null;
  return (
    <div className={`relative mt-2 rounded-lg border bg-white shadow-lg ${className}`}>
      {children}
    </div>
  );
}
