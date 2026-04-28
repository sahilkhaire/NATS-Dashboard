import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'

const ConfirmContext = createContext(null)

export function ConfirmDialogProvider({ children }) {
  const [dialog, setDialog] = useState({ open: false, title: '', description: '', resolve: null })

  const confirm = useCallback((title, description) => {
    return new Promise((resolve) => {
      setDialog({ open: true, title, description, resolve })
    })
  }, [])

  const handleClose = useCallback((accepted) => {
    setDialog((prev) => {
      prev.resolve?.(accepted)
      return { open: false, title: '', description: '', resolve: null }
    })
  }, [])

  const value = useMemo(() => ({ confirm }), [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <AlertDialog open={dialog.open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{dialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleClose(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleClose(true)}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirmDialog() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirmDialog must be used within ConfirmDialogProvider')
  return ctx
}
