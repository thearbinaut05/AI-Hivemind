import React from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster: React.FC<ToasterProps> = (props) => {
  const { theme = "system" } = useTheme()

  // sonner expects theme to be "light" | "dark" | "system" (matches next-themes)
  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg rounded-md border p-4",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground rounded px-2 py-1 text-sm font-semibold",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground rounded px-2 py-1 text-sm",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }