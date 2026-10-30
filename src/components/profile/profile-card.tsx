import { initials } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { UserProfile, UserStats } from "@/types";

export function ProfileCard({ user }: { user: UserProfile }) {
  return (
    <div className="flex flex-col items-center text-center">
      <Avatar className="size-20 ring-2 ring-primary/40 ring-offset-2 ring-offset-background transition-transform hover:scale-105">
        {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.fullName} /> : null}
        <AvatarFallback className="bg-secondary text-xl font-semibold text-secondary-foreground">
          {initials(user.fullName)}
        </AvatarFallback>
      </Avatar>
      <div className="mt-3 text-base font-semibold text-foreground">{user.fullName}</div>
      <div className="text-xs text-muted-foreground">{user.role}</div>
      <div className="num mt-1 text-xs text-primary">@{user.username}</div>
    </div>
  );
}

export function ProfileDetails({ user }: { user: UserProfile }) {
  const rows: Array<[string, string]> = [
    ["Full name", user.fullName],
    ["Username", `@${user.username}`],
    ["Email", user.email],
    ["Role", user.role],
    [
      "Member since",
      new Date(user.memberSince).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
        day: "numeric",
      }),
    ],
  ];
  return (
    <div className="panel divide-y divide-border">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="truncate font-medium text-foreground">{value}</span>
        </div>
      ))}
    </div>
  );
}

export function ProfileStats({ stats }: { stats: UserStats }) {
  const items: Array<[string, number]> = [
    ["Evaluations Run", stats.evaluationsRun],
    ["Experiments", stats.experiments],
    ["Documents", stats.documents],
    ["Queries Evaluated", stats.queriesEvaluated],
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(([label, value]) => (
        <div key={label} className="panel p-3 transition-colors hover:border-border-strong">
          <div className="metric-value text-lg font-semibold text-foreground">
            {value.toLocaleString()}
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}
