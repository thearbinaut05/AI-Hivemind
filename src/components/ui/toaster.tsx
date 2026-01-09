import React from "react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

interface ToastAction {
  /** The action button or element to render inside the toast */
  action: React.ReactNode
}

interface ToastType {
  id: string
  title?: string
  description?: string
  action?: React.ReactNode
  // Include any additional props that Toast component might accept
  [key: string]: any
}

/**
 * Toaster component renders a stack of toast notifications.
 * It subscribes to toast state via the useToast hook.
 * Each toast can have a title, description, action, and close button.
 */
export function Toaster(): JSX.Element {
  const { toasts } = useToast()

  return (
    // ToastProvider sets context for toasts (styling, accessibility, etc.)
    <ToastProvider>
      {toasts.map(({ id, title, description, action, ...props }: ToastType) => (
        <Toast key={id} {...props}>
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          {action && <div>{action}</div>}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
```
This complete code ensures that the Toaster component properly renders toast notifications with all optional parts, providing consistent UI and accessibility support through the composed UI components and context.