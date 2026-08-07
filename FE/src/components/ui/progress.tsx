import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressRootProps {
  value: number | null
  className?: string
  children?: React.ReactNode
}

function Progress({ className, children, value, ...props }: ProgressRootProps) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value ?? undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      data-slot="progress"
      className={cn("flex flex-wrap gap-3", className)}
      {...props}
    >
      {children}
      <ProgressTrack>
        <ProgressIndicator value={value ?? 0} />
      </ProgressTrack>
    </div>
  )
}

function ProgressTrack({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted",
        className
      )}
      data-slot="progress-track"
      {...props}
    />
  )
}

function ProgressIndicator({
  className,
  value,
  ...props
}: { value: number } & React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="progress-indicator"
      className={cn("h-full bg-primary transition-all", className)}
      style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      {...props}
    />
  )
}

function ProgressLabel({ className, ...props }: React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      className={cn("text-sm font-medium", className)}
      data-slot="progress-label"
      {...props}
    />
  )
}

function ProgressValue({ className, ...props }: React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      className={cn(
        "ml-auto text-sm text-muted-foreground tabular-nums",
        className
      )}
      data-slot="progress-value"
      {...props}
    />
  )
}

export {
  Progress,
  ProgressTrack,
  ProgressIndicator,
  ProgressLabel,
  ProgressValue,
}
export type { ProgressRootProps }