import React, { createContext, useContext } from 'react';

const Ctx = createContext(null);

export function DropdownMenu({ open, onOpenChange, children }) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = typeof open === 'boolean';
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = isControlled ? onOpenChange : setInternalOpen;

  return (
    <Ctx.Provider value={{ open: !!isOpen, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </Ctx.Provider>
  );
}

export function DropdownMenuTrigger({ asChild, children }) {
  const ctx = useContext(Ctx);
  const toggle = () => ctx?.setOpen?.(!ctx.open);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: (e) => {
        children.props.onClick?.(e);
        toggle();
      },
    });
  }

  return (
    <button type="button" onClick={toggle}>
      {children}
    </button>
  );
}

export function DropdownMenuContent({ children, align = 'start', className = '' }) {
  const ctx = useContext(Ctx);
  if (!ctx?.open) return null;
  const alignment = align === 'end' ? 'right-0' : 'left-0';
  return (
    <div className={`absolute mt-2 ${alignment} z-50 min-w-[12rem] rounded-md border bg-white shadow-lg p-1 ${className}`}>
      {children}
    </div>
  );
}

export function DropdownMenuItem({ children, onClick, asChild, className = '' }) {
  const ctx = useContext(Ctx);
  const handle = (e) => {
    onClick?.(e);
    ctx?.setOpen?.(false);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: (e) => {
        children.props.onClick?.(e);
        handle(e);
      },
      className: `${children.props.className || ''} ${className}`.trim(),
    });
  }

  return (
    <button
      type="button"
      onClick={handle}
      className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-slate-100 ${className}`}
    >
      {children}
    </button>
  );
}

export function DropdownMenuSeparator() {
  return <div className="my-1 h-px bg-slate-100" />;
}
