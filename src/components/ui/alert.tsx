import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Alert component variants using class-variance-authority
 */
const alertVariants = cva(
  "relative w-full rounded-lg border p-4 " +
    "[&>svg~*]:pl-7 " +
    "[&>svg+div]:translate-y-[-3px] " +
    "[&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground border-border",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    role="alert"
    ref={ref}
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
```
**Explanation:**

- The `cn` import from `@/lib/utils` is assumed to be a standard `clsx` or similar utility function that conditionally joins class names.
- The placeholders `[...]` have been replaced by properly composable class strings within the `cva` utility.
- The component uses proper TypeScript typings, forwarding refs and accepting HTML attributes alongside variant props.
- Variant styling includes default and destructive alert styles with appropriate Tailwind classes for light/dark themes.
- Semantic HTML elements are used (`div` with role alert, `h5` for title).
- The code is ready-to-use in a production React + Tailwind CSS + TypeScript environment and follows best practices in accessibility and composition.