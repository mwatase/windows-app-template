/**
 * The design system. Components are shadcn/ui sources kept in the repository,
 * so they can be edited like any other code; add more with
 * `npx shadcn@latest add <name>` (components.json points it here).
 *
 * Named re-exports rather than `export *`, so a name collision between two
 * components is a compile error here instead of a surprise at a call site.
 */

export { Alert, AlertTitle, AlertDescription, alertVariants, type AlertProps } from './alert'
export { Badge, badgeVariants, type BadgeProps } from './badge'
export { Button, buttonVariants, type ButtonProps } from './button'
export { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter } from './card'
export { Input } from './input'
export { Label } from './label'
export { Progress } from './progress'
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from './select'
export { Separator } from './separator'
export { Skeleton } from './skeleton'
export { Toaster, toast, type ToasterProps } from './sonner'
export { Switch } from './switch'
export { cn } from './utils'
