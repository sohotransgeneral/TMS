"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Moon, Sun, Menu, LogOut, User as UserIcon, Bell } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";

interface TopbarProps {
  name?: string | null;
  email?: string | null;
  role: UserRole;
  companyName?: string | null;
  unreadCount?: number;
  onMenu?: () => void;
}

export function Topbar({
  name,
  email,
  role,
  companyName,
  unreadCount = 0,
  onMenu,
}: TopbarProps) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 h-14 border-b bg-background/80 backdrop-blur flex items-center gap-3 px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenu}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex-1 min-w-0">
        {companyName && (
          <p className="text-xs text-muted-foreground truncate">
            {companyName}
          </p>
        )}
        <p className="text-sm font-medium truncate">{ROLE_LABELS[role]}</p>
      </div>

      <Button
        asChild
        variant="ghost"
        size="icon"
        aria-label="Notifications"
        className="relative"
      >
        <Link href="/admin/notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold grid place-items-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label="Toggle theme"
      >
        <Sun className="h-5 w-5 dark:hidden" />
        <Moon className="h-5 w-5 hidden dark:block" />
      </Button>

      <div className="hidden sm:flex items-center gap-2 pl-3 border-l">
        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-semibold">
          {initials(name ?? email)}
        </div>
        <div className="hidden md:block leading-tight">
          <p className="text-sm font-medium truncate max-w-[160px]">
            {name ?? email}
          </p>
          <p className="text-xs text-muted-foreground truncate max-w-[160px]">
            {email}
          </p>
        </div>
      </div>

      <form action={logoutAction}>
        <Button variant="ghost" size="icon" type="submit" aria-label="Sign out">
          <LogOut className="h-5 w-5" />
        </Button>
      </form>
    </header>
  );
}

// Tiny re-export so callers can also pick up the icon if needed
export { UserIcon };
