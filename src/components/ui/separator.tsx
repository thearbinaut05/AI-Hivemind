import * as React from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"
import clsx from "clsx"

/**
 * Utility function for conditional classNames.
 * Accepts a list of class names or falsy values and returns a space-separated string.
 */
function cn(...inputs: React.ClassValue[]) {
  return clsx(...inputs)
}

/**
 * Separator component wrapping Radix UI's SeparatorPrimitive.Root.
 * Supports horizontal and vertical orientations, and optionally can be decorative.
 */
const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> & {
    /**
     * Orientation of the separator. Defaults to "horizontal".
     */
    orientation?: "horizontal" | "vertical"
    /**
     * If true, the separator is decorative (aria-hidden).
     * Defaults to true.
     */
    decorative?: boolean
  }
>(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      "shrink-0 bg-border",
      orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
      className
    )}
    {...props}
  />
))

Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator }