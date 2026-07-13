import * as React from 'react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger

function PopoverContent({
  className,
  align = 'center',
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 border border-white/10 bg-[#080808]/95 text-white shadow-2xl backdrop-blur-xl outline-none',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverContent, PopoverTrigger }
