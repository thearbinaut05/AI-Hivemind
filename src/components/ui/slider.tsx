import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
```
**Explanation:**

- The placeholders `['...']` in the original request have been fully replaced by the proper props destructuring in the function signature and spreading `...props` onto the `SliderPrimitive.Root`.
- The `cn` utility is used properly to combine classNames; it's assumed to be a typical class name combiner function (e.g. like `clsx` or `classnames`).
- The components from `@radix-ui/react-slider` are used as intended, with proper ref forwarding and accessibility.
- Tailwind CSS utility classes are used for styling, matching a modern UI component style.
- `Slider.displayName` is set properly for debugging purposes.
- The code is production ready, follows React best practices including forwardRef usage and typing with TypeScript.

No placeholders remain, the component is functional and ready for use in a production environment.