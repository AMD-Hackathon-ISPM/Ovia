import * as React from "react"
import { cn } from "@/lib/utils"

interface SwitchProps extends Omit<React.ComponentPropsWithoutRef<"button">, 'type'> {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  size?: "sm" | "default"
}

function Switch({
  className,
  size = "default",
  checked: controlledChecked,
  defaultChecked,
  onCheckedChange,
  ...props
}: SwitchProps) {
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked ?? false)
  const isControlled = controlledChecked !== undefined
  const checked = isControlled ? controlledChecked : internalChecked

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (props.disabled) return
    const newValue = !checked
    if (!isControlled) setInternalChecked(newValue)
    onCheckedChange?.(newValue)
    props.onClick?.(e)
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-slot="switch"
      data-size={size}
      data-checked={checked ? "" : undefined}
      data-unchecked={checked ? undefined : ""}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        checked ? "bg-primary" : "bg-input dark:bg-input/80",
        className
      )}
      disabled={props.disabled}
      onClick={handleClick}
      {...props}
    >
      <span
        data-slot="switch-thumb"
        data-checked={checked ? "" : undefined}
        data-unchecked={checked ? undefined : ""}
        className={cn(
          "pointer-events-none block rounded-full bg-background ring-0 transition-transform dark:data-checked:bg-primary-foreground dark:data-unchecked:bg-foreground",
          size === "default" ? "size-4" : "size-3",
          checked
            ? size === "default"
              ? "translate-x-[calc(100%-2px)]"
              : "translate-x-[calc(100%-2px)]"
            : "translate-x-0"
        )}
      />
    </button>
  )
}

export { Switch }
export type { SwitchProps }