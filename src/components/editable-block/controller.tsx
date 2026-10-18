import { useEffect, useRef, useState } from 'react'

const FIRST_FIELD_SELECTOR = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled])'

export const useController = () => {
  const [isEditing, setIsEditing] = useState(false)
  const editContainerRef = useRef<HTMLDivElement>(null)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const shouldFocusEditButtonRef = useRef(false)

  useEffect(() => {
    if (isEditing) {
      editContainerRef.current?.querySelector<HTMLElement>(FIRST_FIELD_SELECTOR)?.focus()
      return
    }
    if (!shouldFocusEditButtonRef.current) return
    shouldFocusEditButtonRef.current = false
    editButtonRef.current?.focus()
  }, [isEditing])

  const startEditing = () => setIsEditing(true)

  const stopEditing = () => {
    shouldFocusEditButtonRef.current = true
    setIsEditing(false)
  }

  return { isEditing, editContainerRef, editButtonRef, startEditing, stopEditing }
}
