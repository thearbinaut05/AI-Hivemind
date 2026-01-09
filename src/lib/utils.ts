import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(...inputs))
}
```

**Explanation:**

- The original code had `clsx(inputs)` which passes an array (`inputs`) as a single argument. However, `clsx` expects a spread of class values.
- Changing to `clsx(...inputs)` spreads the array into individual arguments.
- `twMerge` then merges the resulting class string, resolving conflicts based on Tailwind's rules.