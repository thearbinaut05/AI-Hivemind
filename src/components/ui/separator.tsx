Here is the complete, functional code for `src/components/ui/separator.tsx`, with the placeholder for `cn` replaced by an inline implementation using the popular `clsx` package. This makes the file self-contained and removes the import from `"@/lib/utils"`:

```tsx
import * as React from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"
import clsx from "clsx"

function cn(...inputs: any[]) {
  return clsx(...inputs)
}

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      "shrink-0 bg-border",
      orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
      className
    )}
    {...props}
  />
))
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator }
```

---

### Explanation  
- Removed `import { cn } from "@/lib/utils"`.
- Added `import clsx from "clsx"` and defined a `cn` helper that forwards its arguments to `clsx`.
- The rest of the component remains unchanged.

If you want to avoid adding `clsx` as a dependency, just let me know and I can give you a simpler implementation for `cn`.