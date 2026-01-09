import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
```
**Explanation:**

- The only placeholders were `placeholder` and `...`, which are standard JSX and TypeScript code usage.
- The `placeholder` in the `textarea` placeholder text CSS class is correctly `placeholder:text-muted-foreground`.
- The spread operator `...props` is correctly in place to forward all other props.
- The rest of the code is production-ready, using forwardRef for proper ref forwarding, TypeScript interface extension for props, and the utility `cn` function to conditionally join classNames.
  
This code is fully functional, production-ready, and follows best practices for a React textarea component with Tailwind CSS styling.