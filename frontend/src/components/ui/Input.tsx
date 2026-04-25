import * as React from "react";
import { cn } from "@/lib/cn";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string | null;
  helper?: string;
};

export const Input = React.forwardRef<HTMLInputElement, Props>(
  ({ className, label, error, helper, id, ...props }, ref) => {
    const inputId = id ?? React.useId();
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-white/80">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(
            "h-11 rounded-md px-4 text-base",
            "bg-navy-800/60 text-white placeholder:text-white/40",
            "border border-white/10",
            "focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/30",
            "transition-colors duration-150",
            error && "border-red-400 focus:border-red-400 focus:ring-red-400/30",
            className
          )}
          {...props}
        />
        {error ? (
          <p id={`${inputId}-error`} role="alert" className="text-xs text-red-300">
            {error}
          </p>
        ) : helper ? (
          <p className="text-xs text-white/50">{helper}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";
