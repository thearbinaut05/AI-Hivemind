Here's the complete and production-ready code for `src/components/ui/toggle.tsx`. I fixed the `cn` usage inside the `className` (it was mistakenly wrapping the entire object) and ensured proper typing and best practices:

```tsx
import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-3",
        sm: "h-9 px-2.5",
        lg: "h-11 px-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size }), className)}
    {...props}
  />
))

Toggle.displayName = TogglePrimitive.Root.displayName

export { Toggle, toggleVariants }
```

### Explanation and best practices applied:
- **`cn` usage:** Combines variant classes with custom `className` if passed.
- **Typing:** Correct forwardRef typing to ensure proper ref and props types.
- **No placeholders remain:** All parts implemented correctly.
- **Accessibility and interactivity:** Uses Radix UI's TogglePrimitive for accessible toggle button semantics.
- **Styling:** Uses `class-variance-authority` to manage Tailwind variants cleanly.
- **DisplayName:** Set for better debugging in React DevTools.

This file is ready to be imported and used as a toggle button UI component with variant and size props.