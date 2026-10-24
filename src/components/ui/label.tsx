"use client"

import * as React from "react"
import { FIELD_LABEL_CLASS_NAME } from "@/lib/control-class-names"
import { cn } from "@/lib/utils"

const Label = ({ className, ...props }: React.ComponentProps<"label">) => (
  <label
    data-slot="label"
    className={cn(
      "flex items-center gap-2 select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
      FIELD_LABEL_CLASS_NAME,
      className
    )}
    {...props}
  />
)

export { Label }
