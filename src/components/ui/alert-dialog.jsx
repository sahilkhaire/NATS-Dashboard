import * as React from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import { cn } from "../../lib/utils"
import { buttonVariants } from "./button"

const AlertDialog = AlertDialogPrimitive.Root
const AlertDialogTrigger = AlertDialogPrimitive.Trigger
const AlertDialogPortal = AlertDialogPrimitive.Portal

const AlertDialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay ref={ref} className={cn("fixed inset-0 z-50 bg-black/65", className)} {...props} />
))
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName

const AlertDialogContent = React.forwardRef(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn("fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-lg border border-border bg-card p-6 shadow-surface", className)}
      {...props}
    />
  </AlertDialogPortal>
))
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName

const AlertDialogHeader = ({ className, ...props }) => <div className={cn("space-y-2", className)} {...props} />
const AlertDialogFooter = ({ className, ...props }) => <div className={cn("mt-4 flex justify-end gap-2", className)} {...props} />
const AlertDialogTitle = React.forwardRef(({ className, ...props }, ref) => <AlertDialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold", className)} {...props} />)
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName
const AlertDialogDescription = React.forwardRef(({ className, ...props }, ref) => <AlertDialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />)
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName
const AlertDialogAction = React.forwardRef(({ className, ...props }, ref) => <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants({ variant: "destructive" }), className)} {...props} />)
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName
const AlertDialogCancel = React.forwardRef(({ className, ...props }, ref) => <AlertDialogPrimitive.Cancel ref={ref} className={cn(buttonVariants({ variant: "outline" }), className)} {...props} />)
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}
