import type { ComponentType } from 'react'

import { cn } from '@/ui'

import appIcon from '../../../src-tauri/icons/128x128.png'

export interface NavItem {
  id: string
  label: string
  icon: ComponentType<{ className?: string }>
}

interface SidebarProps {
  name: string
  items: readonly NavItem[]
  footer: readonly NavItem[]
  active: string
  onSelect: (id: string) => void
}

export function Sidebar({ name, items, footer, active, onSelect }: SidebarProps) {
  return (
    <nav aria-label="Main" className="flex w-56 shrink-0 flex-col border-r border-border bg-sidebar select-none">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <img src={appIcon} alt="" className="size-7" draggable={false} />
        <span className="truncate text-sm font-semibold">{name}</span>
      </div>
      <ul className="flex-1 space-y-0.5 px-2">
        {items.map((item) => (
          <li key={item.id}>
            <NavButton item={item} current={item.id === active} onSelect={onSelect} />
          </li>
        ))}
      </ul>
      <ul className="space-y-0.5 px-2 pb-3">
        {footer.map((item) => (
          <li key={item.id}>
            <NavButton item={item} current={item.id === active} onSelect={onSelect} />
          </li>
        ))}
      </ul>
    </nav>
  )
}

function NavButton({ item, current, onSelect }: { item: NavItem; current: boolean; onSelect: (id: string) => void }) {
  const Icon = item.icon
  return (
    <button
      type="button"
      aria-current={current ? 'page' : undefined}
      onClick={() => onSelect(item.id)}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm outline-none transition-colors',
        'focus-visible:ring-[3px] focus-visible:ring-ring/50',
        current
          ? 'bg-accent font-medium text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </button>
  )
}
