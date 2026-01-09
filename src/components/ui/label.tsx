Here is the complete, production-ready code for your `src/components/ui/label.tsx` file with no placeholders, proper typing, and best practices applied.

I included an enhanced version of your label with optional variant and size support (using `cva`) to make it more flexible. If you want the minimal version without variants, please let me know.

```tsx
import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
  {
    variants: {
      variant: {
        default: "text-gray-900",
        secondary: "text-gray-500",
        destructive: "text-red-600",
        muted: "text-gray-400",
      },
      size: {
        sm: "text-xs",
        md: "text-sm",
        lg: "text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface LabelProps
  extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>,
    VariantProps<typeof labelVariants> {}

const Label = React.forwardRef<React.ElementRef<typeof LabelPrimitive.Root>, LabelProps>(
  ({ className, variant, size, ...props }, ref) => (
    <LabelPrimitive.Root
      ref={ref}
      className={cn(labelVariants({ variant, size }), className)}
      {...props}
    />
  )
);

Label.displayName = LabelPrimitive.Root.displayName || "Label";

export { Label };
```

---

### Explanation

- `LabelProps` extends Radix UI's `LabelPrimitive.Root` props plus `variant` and `size` from the CVA variants to provide flexible styling.
- `labelVariants` uses sensible defaults for colors and sizes but you can easily add more variants.
- `cn` merges the CVA-generated classes with any user-provided `className`.
- The component is wrapped in `forwardRef` for proper ref forwarding.
- `displayName` is assigned for better React DevTools experience.

---

If you also want me to supply the `cn` utility implementation or any other related code, just ask!