import * as React from "react"
import { cn } from "@/lib/utils"

/* ───────── Context ───────── */

interface SelectContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  value: string | undefined
  onValueChange: (value: string) => void
  activeDescendant: string | undefined
  setActiveDescendant: (id: string | undefined) => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
  listRef: React.RefObject<HTMLDivElement | null>
  labelId: string
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

function useSelectContext(name: string) {
  const ctx = React.useContext(SelectContext)
  if (!ctx) throw new Error(`<${name}> must be used inside <Select>`)
  return ctx
}

let _idCounter = 0
function nextId() {
  return `select-${++_idCounter}`
}

/* ───────── Root ───────── */

interface SelectRootProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children?: React.ReactNode
}

function Select({ value: controlledValue, defaultValue, onValueChange, children }: SelectRootProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "")
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : internalValue

  const [open, setOpen] = React.useState(false)
  const [activeDescendant, setActiveDescendant] = React.useState<string | undefined>()
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const [labelId] = React.useState(nextId)

  const handleValueChange = React.useCallback(
    (v: string) => {
      if (!isControlled) setInternalValue(v)
      onValueChange?.(v)
      setOpen(false)
      triggerRef.current?.focus()
    },
    [isControlled, onValueChange]
  )

  const ctx = React.useMemo<SelectContextValue>(
    () => ({
      open,
      setOpen,
      value,
      onValueChange: handleValueChange,
      activeDescendant,
      setActiveDescendant,
      triggerRef,
      listRef,
      labelId,
    }),
    [open, value, handleValueChange, activeDescendant, labelId]
  )

  return (
    <SelectContext.Provider value={ctx}>
      {children}
    </SelectContext.Provider>
  )
}

/* ───────── Group ───────── */

function SelectGroup({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  )
}

/* ───────── Value ───────── */

function SelectValue({ className, ...props }: React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      data-slot="select-value"
      className={cn("flex flex-1 text-left", className)}
      {...props}
    />
  )
}

/* ───────── Trigger ───────── */

interface SelectTriggerProps extends React.ComponentPropsWithoutRef<"button"> {
  size?: "sm" | "default"
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectTriggerProps) {
  const ctx = useSelectContext("SelectTrigger")
  const selectedChild = React.Children.toArray(children).find(
    (child) =>
      React.isValidElement(child) &&
      (child as React.ReactElement).type === SelectValue
  )

  return (
    <button
      type="button"
      role="combobox"
      aria-expanded={ctx.open}
      aria-haspopup="listbox"
      aria-controls={ctx.labelId}
      aria-activedescendant={ctx.activeDescendant}
      ref={ctx.triggerRef}
      data-slot="select-trigger"
      data-size={size}
      onClick={() => ctx.setOpen(!ctx.open)}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          if (!ctx.open) {
            ctx.setOpen(true)
          }
        }
        if (e.key === "Escape") {
          ctx.setOpen(false)
          ctx.triggerRef.current?.focus()
        }
        if (e.key === "ArrowUp" && ctx.open) {
          e.preventDefault()
          // focus management handled by list
        }
      }}
      className={cn(
        "flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none size-4 text-muted-foreground"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  )
}

/* ───────── Content / Popup ───────── */

interface SelectContentProps extends React.ComponentPropsWithoutRef<"div"> {
  side?: "top" | "bottom"
  sideOffset?: number
  align?: "start" | "center" | "end"
  alignOffset?: number
  alignItemWithTrigger?: boolean
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: SelectContentProps) {
  const ctx = useSelectContext("SelectContent")
  const [posStyle, setPosStyle] = React.useState<React.CSSProperties>({})
  const contentRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!ctx.open || !ctx.triggerRef.current) return
    const trigger = ctx.triggerRef.current
    const rect = trigger.getBoundingClientRect()
    const style: React.CSSProperties = {
      position: "fixed",
      zIndex: 50,
      minWidth: Math.max(rect.width, 144),
    }
    if (side === "bottom") {
      style.top = rect.bottom + sideOffset
    } else {
      style.top = rect.top - sideOffset
      // Will need to adjust, for now simple
    }
    if (align === "center") {
      style.left = rect.left + rect.width / 2
      style.transform = "translateX(-50%)"
    } else if (align === "start") {
      style.left = rect.left + alignOffset
    } else {
      style.left = rect.right - (alignOffset || 0)
      style.transform = "translateX(-100%)"
    }
    // clamp to viewport
    setPosStyle(style)
  }, [ctx.open, ctx.triggerRef, side, sideOffset, align, alignOffset])

  React.useEffect(() => {
    if (!ctx.open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(e.target as Node) &&
        ctx.triggerRef.current &&
        !ctx.triggerRef.current.contains(e.target as Node)
      ) {
        ctx.setOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        ctx.setOpen(false)
        ctx.triggerRef.current?.focus()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [ctx.open, ctx.triggerRef, ctx.setOpen])

  if (!ctx.open) return null

  // Portal-like: render in a portal would need createPortal, but for simplicity render inline fixed
  return (
    <div
      ref={contentRef}
      role="listbox"
      id={ctx.labelId}
      data-slot="select-content"
      className={cn(
        "isolate z-50 max-h-60 overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10",
        className
      )}
      style={posStyle}
      {...props}
    >
      {children}
    </div>
  )
}

/* ───────── Item ───────── */

function SelectItem({
  className,
  children,
  value,
  ...props
}: { value: string } & React.ComponentPropsWithoutRef<"div">) {
  const ctx = useSelectContext("SelectItem")
  const isSelected = ctx.value === value
  const itemRef = React.useRef<HTMLDivElement | null>(null)

  return (
    <div
      ref={itemRef}
      role="option"
      aria-selected={isSelected}
      data-slot="select-item"
      data-value={value}
      onClick={() => ctx.onValueChange(value)}
      onMouseEnter={() => ctx.setActiveDescendant(itemRef.current?.id)}
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        isSelected && "bg-accent text-accent-foreground",
        className
      )}
      {...props}
    >
      <span className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">{children}</span>
      {isSelected && (
        <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      )}
    </div>
  )
}

/* ───────── Label ───────── */

function SelectLabel({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="select-label"
      className={cn("px-1.5 py-1 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

/* ───────── Separator ───────── */

function SelectSeparator({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

/* ───────── Scroll Arrows ───────── */

function SelectScrollUpButton({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </div>
  )
}

function SelectScrollDownButton({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  )
}

/* ───────── Exports ───────── */

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
export type { SelectRootProps, SelectTriggerProps, SelectContentProps }