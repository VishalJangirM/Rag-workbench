import { Link, useLocation } from "@tanstack/react-router";
import {
  AlertTriangle,
  Beaker,
  Bell,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  Cpu,
  Database,
  FileText,
  FlaskConical,
  LayoutDashboard,
  MessageSquareText,
  Settings,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { USE_MOCK_TRANSPORT } from "@/services/api-client";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/playground", label: "RAG Playground", icon: MessageSquareText },
  { to: "/evaluations", label: "Evaluations", icon: ClipboardList },
  { to: "/experiments", label: "Experiments", icon: FlaskConical },
  { to: "/failures", label: "Failure Analysis", icon: AlertTriangle },
  { to: "/models", label: "Models", icon: Cpu },
  { to: "/datasets", label: "Datasets", icon: Database },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function ConnectionIndicator({ collapsed }: { collapsed?: boolean }) {
  const connected = !USE_MOCK_TRANSPORT;
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs",
        collapsed ? "justify-center" : "",
      )}
    >
      <span className="relative flex size-2">
        <span
          className={cn(
            "absolute inline-flex size-full rounded-full",
            connected ? "bg-success" : "bg-warning",
          )}
        />
      </span>
      {!collapsed && (
        <span className="text-muted-foreground">
          {connected ? "Backend Connected" : "Mock transport"}
        </span>
      )}
    </div>
  );
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation();
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200",
        collapsed ? "w-14" : "w-60",
      )}
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Beaker className="size-4" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-sidebar-foreground">
              RAGBench
            </div>
            <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
              Evaluate. Benchmark. Optimize.
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => {
          const active =
            item.to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.to);
          const link = (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
          return collapsed ? (
            <Tooltip key={item.to}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-sidebar-border p-3">
        <ConnectionIndicator collapsed={collapsed} />
        {!collapsed && (
          <div className="rounded-md border border-sidebar-border bg-sidebar-accent/40 px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Workspace
            </div>
            <div className="truncate text-xs font-medium text-sidebar-foreground">
              Acme AI Platform
            </div>
          </div>
        )}
        <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
          <Avatar className="size-7">
            <AvatarFallback className="bg-secondary text-[10px] font-semibold text-secondary-foreground">
              VS
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-sidebar-foreground">
                Vishal Jangir
              </div>
              <div className="truncate text-[10px] text-muted-foreground">ML Engineer</div>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-7 w-full text-muted-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
        </Button>
      </div>
    </aside>
  );
}

function TopBar({ title, breadcrumb }: { title: string; breadcrumb?: string[] | undefined }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-background/95 px-6 backdrop-blur">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <span className="font-semibold text-foreground">RAGBench</span>
        {(breadcrumb ?? [title]).map((crumb) => (
          <span key={crumb} className="flex items-center gap-2">
            <span className="text-muted-foreground/50">/</span>
            <span className="truncate text-muted-foreground">{crumb}</span>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1 md:flex">
          <span className={cn("size-1.5 rounded-full", USE_MOCK_TRANSPORT ? "bg-warning" : "bg-success")} />
          <span className="text-xs text-muted-foreground">
            {USE_MOCK_TRANSPORT ? "Mock transport" : "Backend Connected"}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Acme AI Platform
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Acme AI Platform</DropdownMenuItem>
            <DropdownMenuItem>Sandbox</DropdownMenuItem>
            <DropdownMenuItem>Manage workspaces</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 text-muted-foreground" aria-label="Notifications">
          <Bell className="size-4" />
          <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
        </Button>
        <Avatar className="size-8">
          <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
            VS
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}

export function AppShell({
  title,
  breadcrumb,
  children,
}: {
  title: string;
  breadcrumb?: string[] | undefined;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      <div className={cn("transition-[padding] duration-200", collapsed ? "pl-14" : "pl-60")}>
        <TopBar title={title} breadcrumb={breadcrumb} />
        <main className="mx-auto w-full max-w-[1400px] space-y-6 p-6">{children}</main>
      </div>
    </div>
  );
}
