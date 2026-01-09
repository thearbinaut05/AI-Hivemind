import React from "react"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Utility helper to combine class names conditionally.
 * Filters out falsy values.
 * @param classes - strings or undefined values
 * @returns combined class name string
 */
function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ")
}

/**
 * Skeleton component used as a loading placeholder.
 * Applies pulsing animation and muted background to indicate loading state.
 *
 * @param className - Additional CSS classes to add.
 * @param props - Additional div props.
 * @returns React element
 */
const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
```
