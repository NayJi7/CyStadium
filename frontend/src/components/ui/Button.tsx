import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const base =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-md " +
  "transition-all duration-200 ease-out cursor-pointer select-none " +
  "disabled:opacity-50 disabled:cursor-not-allowed " +
  "focus-visible:outline-cyan-400 focus-visible:outline-offset-2";

const variants: Record<Variant, string> = {
  primary:
    "bg-cyan-400 text-navy-900 hover:bg-cyan-300 active:bg-cyan-500 " +
    "shadow-glow hover:shadow-[0_0_60px_-8px_rgba(34,211,238,0.65)]",
  ghost:
    "bg-transparent text-white/80 hover:text-white hover:bg-white/10",
  outline:
    "border-2 border-white/20 text-white hover:border-cyan-400 hover:text-cyan-300",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-base",
  lg: "h-14 px-8 text-lg tracking-wide",
};

export const Button = React.forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  )
);
Button.displayName = "Button";
