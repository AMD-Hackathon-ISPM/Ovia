import * as React from "react"
import { cn } from "@/lib/utils"

interface CheckboxProps extends Omit<React.ComponentPropsWithoutRef<"button">, 'type'> {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

function Checkbox({
  className,
  checked: controlledChecked,
  defaultChecked,
  onCheckedChange,
  ...props
}: CheckboxProps) {
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
      role="checkbox"
      aria-checked={checked}
      data-slot="checkbox"
      data-checked={checked ? "" : undefined}
      className={cn(
        "peer relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input transition-colors outline-none group-has-disabled/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        checked
          ? "border-primary bg-primary text-primary-foreground dark:bg-primary"
          : "border-input",
        className
      )}
      disabled={props.disabled}
      onClick={handleClick}
      {...props}
    >
      <span
        data-slot="checkbox-indicator"
        className={cn(
          "grid place-content-center text-current transition-none",
          checked ? "opacity-100" : "opacity-0"
        )}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    </button>
  )
}

export { Checkbox }
export type { CheckboxProps }