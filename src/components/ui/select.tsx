import * as React from 'react'
import { Select as BaseSelect } from '@base-ui/react/select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectContextValue {
  labels: Record<string, React.ReactNode>
  registerLabel: (value: any, label: React.ReactNode) => void
  currentValue?: any
}

const SelectContext = React.createContext<SelectContextValue>({
  labels: {},
  registerLabel: () => {},
  currentValue: undefined,
})

function Select<Value = any>({
  children,
  value,
  defaultValue,
  onValueChange,
  ...props
}: BaseSelect.Root.Props<Value, false> & {
  children?: React.ReactNode
}) {
  const [labels, setLabels] = React.useState<Record<string, React.ReactNode>>({})

  const registerLabel = React.useCallback((val: any, label: React.ReactNode) => {
    if (val != null) {
      setLabels((prev) => {
        if (prev[String(val)] === label) return prev
        return { ...prev, [String(val)]: label }
      })
    }
  }, [])

  return (
    <SelectContext.Provider value={{ labels, registerLabel, currentValue: value ?? defaultValue }}>
      <BaseSelect.Root
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        {...props}
      >
        {children}
      </BaseSelect.Root>
    </SelectContext.Provider>
  )
}

function SelectGroup({ className, ...props }: BaseSelect.Group.Props) {
  return <BaseSelect.Group className={cn('p-1', className)} {...props} />
}

function SelectValue({
  className,
  placeholder,
  children,
  ...props
}: BaseSelect.Value.Props & {
  placeholder?: React.ReactNode
}) {
  const { labels, currentValue } = React.useContext(SelectContext)

  return (
    <BaseSelect.Value
      className={cn('data-placeholder:text-muted-foreground truncate text-left', className)}
      placeholder={placeholder}
      {...props}
    >
      {(val) => {
        if (typeof children === 'function') {
          return (children as any)(val)
        }
        if (children) return children

        const activeVal = val ?? currentValue
        if (activeVal != null && labels[String(activeVal)] != null) {
          return labels[String(activeVal)]
        }
        return val != null ? String(val) : placeholder
      }}
    </BaseSelect.Value>
  )
}

function SelectTrigger({
  className,
  children,
  ...props
}: BaseSelect.Trigger.Props) {
  return (
    <BaseSelect.Trigger
      className={cn(
        'flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-input bg-background/80 px-3.5 py-2 text-sm text-foreground shadow-xs ring-offset-background transition-colors hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 cursor-pointer dark:border-border dark:bg-card/60',
        className
      )}
      {...props}
    >
      {children}
      <BaseSelect.Icon className="shrink-0 text-muted-foreground">
        <ChevronDown className="h-4 w-4 opacity-70 transition-transform duration-200" />
      </BaseSelect.Icon>
    </BaseSelect.Trigger>
  )
}

function SelectContent({
  className,
  children,
  sideOffset = 6,
  align = 'start',
  ...props
}: BaseSelect.Popup.Props & {
  sideOffset?: number
  align?: 'start' | 'center' | 'end'
}) {
  return (
    <BaseSelect.Portal>
      <BaseSelect.Positioner
        sideOffset={sideOffset}
        align={align}
        alignItemWithTrigger={false}
        className="z-50 select-none outline-none"
      >
        <BaseSelect.Popup
          className={cn(
            'relative z-50 min-w-[8.5rem] overflow-hidden rounded-2xl border border-border bg-popover/95 backdrop-blur-md p-1.5 text-popover-foreground shadow-xl ring-1 ring-foreground/5 transition-all duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 dark:border-neutral-800 dark:bg-neutral-900/95 dark:shadow-2xl dark:ring-white/10',
            className
          )}
          {...props}
        >
          <BaseSelect.ScrollUpArrow className="flex h-5 items-center justify-center text-muted-foreground py-1">
            <ChevronUp className="h-3.5 w-3.5" />
          </BaseSelect.ScrollUpArrow>
          <BaseSelect.List className="max-h-64 overflow-y-auto space-y-0.5">
            {children}
          </BaseSelect.List>
          <BaseSelect.ScrollDownArrow className="flex h-5 items-center justify-center text-muted-foreground py-1">
            <ChevronDown className="h-3.5 w-3.5" />
          </BaseSelect.ScrollDownArrow>
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  )
}

function SelectItem({
  className,
  children,
  value,
  ...props
}: BaseSelect.Item.Props & {
  value: string | number
}) {
  const { registerLabel } = React.useContext(SelectContext)

  React.useEffect(() => {
    if (value != null && children != null) {
      registerLabel(value, children)
    }
  }, [value, children, registerLabel])

  return (
    <BaseSelect.Item
      value={value}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-xl py-2 pl-8 pr-3 text-xs sm:text-sm font-medium outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:data-[highlighted]:bg-neutral-800/90',
        className
      )}
      {...props}
    >
      <span className="absolute left-2.5 flex h-3.5 w-3.5 items-center justify-center">
        <BaseSelect.ItemIndicator>
          <Check className="h-4 w-4 text-primary" />
        </BaseSelect.ItemIndicator>
      </span>
      <BaseSelect.ItemText className="truncate">{children}</BaseSelect.ItemText>
    </BaseSelect.Item>
  )
}

function SelectLabel({
  className,
  ...props
}: BaseSelect.GroupLabel.Props) {
  return (
    <BaseSelect.GroupLabel
      className={cn('px-2.5 py-1 text-xs font-semibold text-muted-foreground/80 tracking-wide', className)}
      {...props}
    />
  )
}

function SelectSeparator({
  className,
  ...props
}: BaseSelect.Separator.Props) {
  return (
    <BaseSelect.Separator
      className={cn('-mx-1 my-1.5 h-px bg-border/60', className)}
      {...props}
    />
  )
}

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
}
