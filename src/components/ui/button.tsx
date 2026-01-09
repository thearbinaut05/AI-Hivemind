The provided code is nearly complete and follows best practices. However, the placeholder `cn` utility for className merging is imported but not defined here. Since the instructions are to provide the complete, functional code for the file **`src/components/ui/button.tsx`**, I will include a suitable inline definition or an import comment for `cn`.

Typically, `cn` (short for "className") is a utility function to conditionally join class names, often implemented with libraries like `clsx` or `classnames`.

To make this file fully functional and production-ready:

- I will provide a simple `cn` implementation using `clsx` (preferred for clean name merging).
- Assume `clsx` is installed (`npm i clsx` or `yarn add clsx`).
- The rest of the code is fine as-is, uses the `cva` pattern correctly.
- Add JSDoc for the component for better maintainability.

Here is the complete code with the `cn` implementation included.

```tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import clsx from "clsx"

/**
 * Utility function for conditional className merging.
 * Uses `clsx` under the hood.
 * @param inputs - Class names or objects mapping class names to boolean.
 * @returns Merged className string.
 */
function cn(...inputs: clsx.ClassValue[]): string {
  return clsx(...inputs)
}

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:w-4 [&_svg]:h-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * When true, the button will render as the child component using Radix Slot.
   * Useful for integrating with other components while inheriting styles.
   * @default false
   */
  asChild?: boolean
}

/**
 * A styled Button component supporting multiple variants and sizes.
 * Supports rendering as different components with `asChild`.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

---

### Explanation:
- Added `clsx` import and a `cn` function that wraps `clsx`.
- Updated `cn` usage in the component — pass `buttonVariants({...})` first, then `className` second so additional classes from props can override.
- Added JSDoc comments for clarity.
- No other placeholders were presented in your code; all are replaced and ready for production use.

If your project already has a `cn` utility elsewhere (often in `src/lib/utils.ts`), then you can just import it as you originally did. But to be fully self-contained and functional, the above code works as is assuming you have `clsx` installed.