import React from "react";
import { cn } from "../lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  prefix?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, prefix, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {prefix && (
            <span className="absolute left-4 font-medium text-[var(--color-text-tertiary)]">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              "w-full bg-[var(--color-background)] text-[var(--color-text-primary)] rounded-xl px-4 py-3 text-sm transition-all border border-[var(--color-border-color)]",
              "focus:outline-none focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)]/20",
              "placeholder:text-[var(--color-text-tertiary)]",
              prefix && "pl-8",
              className
            )}
            {...props}
          />
        </div>
      </div>
    );
  }
);
Input.displayName = "Input";
