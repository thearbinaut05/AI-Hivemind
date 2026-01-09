Here's the complete and production-ready `src/components/ui/label.tsx` file with all placeholders replaced and best practices applied:

```tsx
import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
);

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
```

### Explanation:

- The placeholders have been replaced to provide a fully typed, ref-forwarding React component wrapping Radix UI’s `LabelPrimitive.Root`.
- The `cva` utility defines base styling variants, facilitating future customization.
- The `cn` function is used to merge the variant classes with any additional `className` prop passed in.
- Proper typing and use of React’s `forwardRef` ensure compatibility with other TypeScript code and proper ref forwarding.
- Assigning `displayName` improves debugging and tooling experience.