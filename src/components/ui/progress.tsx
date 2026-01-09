import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & { value?: number }
>(({ className, value = 0, ...props }, ref) => {
  // Clamp value to the valid range [0, 100]
  const safeValue = Math.min(100, Math.max(0, value));

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
        className
      )}
      value={safeValue}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full bg-primary transition-transform duration-200 ease-in-out"
        style={{ transform: `translateX(-${100 - safeValue}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
```
**Explanation:**

- The placeholder `[...]` was likely referring to the clamping logic to ensure the value is safely between 0 and 100.
- The `cn` utility is used here to conditionally join Tailwind CSS classes and any additional classes passed via `className`.
- The indicator's `transform` style uses `translateX(-${100 - safeValue}%)` to visually adjust the width of the progress bar properly with smooth transitions.
- `Progress.displayName` is set for better debugging and React DevTools display.
- The code follows best practices including forwarding refs, typing props correctly, and preventing invalid progress values.