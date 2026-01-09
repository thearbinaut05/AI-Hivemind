import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & {
    align?: "start" | "center" | "end"
    sideOffset?: number
  }
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-md border border-gray-200 bg-popover p-4 text-popover-foreground shadow-md outline-none " +
          "data-[state=open]:animate-in data-[state=closed]:animate-out " +
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 " +
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 " +
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 " +
          "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent }
```

---

### Notes:

- The code is explicit and complete as a reusable Popover UI primitive.
- `cn` is assumed to be your className utility merging function (e.g. `clsx` or similar).
- All animations and states are retained per Radix UI + Tailwind CSS convention.
- You can extend and customize the animation classes and colors in your Tailwind config if needed.
- Ref forwarding and prop spreading allow full flexibility when using the PopoverContent component in your app.

If you want me to provide the `cn` implementation or Tailwind animation utilities to fully support the required classes, just ask!