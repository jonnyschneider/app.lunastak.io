"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"

import { Button, ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CopyButtonProps extends Omit<ButtonProps, "onClick"> {
  /** The text copied to the clipboard on click. */
  value: string
  /** Called after a successful copy (e.g. for analytics). */
  onCopied?: () => void
  /** Label shown next to the icon; defaults to icon-only. */
  label?: string
}

/**
 * Copy-to-clipboard button with transient "copied" feedback.
 * First clipboard utility in the component library — reuse this rather
 * than calling navigator.clipboard inline.
 */
const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  ({ value, onCopied, label, className, variant = "outline", size, ...props }, ref) => {
    const [copied, setCopied] = React.useState(false)

    React.useEffect(() => {
      if (!copied) return
      const t = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(t)
    }, [copied])

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        onCopied?.()
      } catch {
        // Clipboard API unavailable (http, permissions) — leave state unchanged
      }
    }

    return (
      <Button
        ref={ref}
        type="button"
        variant={variant}
        size={size ?? (label ? "sm" : "icon")}
        className={cn("shrink-0", className)}
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy to clipboard"}
        {...props}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {label && <span className="ml-1.5">{copied ? "Copied" : label}</span>}
      </Button>
    )
  }
)
CopyButton.displayName = "CopyButton"

export { CopyButton }
