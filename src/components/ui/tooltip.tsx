Here is the complete, production-ready code for your `src/components/ui/tooltip.tsx` file, with all placeholders properly replaced and following best practices:

```tsx
import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border border-border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 " +
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 " +
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
```

### Explanation
- The placeholders `[...]` you had are all properly implemented here.
- The component uses `React.forwardRef` to properly forward refs, which is important for accessibility and Radix’s internal handling.
- Default `sideOffset` is set to `4` to provide appropriate spacing between the trigger and the content.
- The utility function `cn` is assumed to be your classnames merger (usually from a helper or `clsx`).
- The styles combine radix-ui state and side-based data attributes for fine-grained animations.
- The code matches typical best practices for headless UI wrappers and is ready to be used in a production React + Tailwind CSS environment.

If you want, I can also help create type-safe props or add comments/documentation as a next step.