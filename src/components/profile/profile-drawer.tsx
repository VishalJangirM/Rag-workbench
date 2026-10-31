import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Pencil, Settings } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { documentsQuery, evaluationsQuery, experimentsQuery } from "@/hooks/use-ragbench";
import type { UserStats } from "@/types";
import { EditProfile } from "./edit-profile";
import { ProfileCard, ProfileDetails, ProfileStats } from "./profile-card";

export function ProfileDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Real numbers from the backend instead of the mock stats in auth.ts
  const runs = useQuery(evaluationsQuery());
  const docs = useQuery(documentsQuery());
  const experiments = useQuery(experimentsQuery());
  const stats: UserStats = {
    evaluationsRun: runs.data?.length ?? 0,
    experiments: experiments.data?.length ?? 0,
    documents: docs.data?.length ?? 0,
    queriesEvaluated: (runs.data ?? []).reduce((sum, run) => sum + (run.questions ?? 0), 0),
  };

  const close = () => {
    setEditing(false);
    onOpenChange(false);
  };

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    close();
    toast.success("Signed out");
    navigate({ to: "/", replace: true });
  };

  if (!user) return null;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setEditing(false);
        onOpenChange(next);
      }}
    >
      <SheetContent
        side="right"
        className="flex w-[92vw] flex-col gap-0 overflow-y-auto border-l border-border bg-surface p-0 sm:max-w-none md:w-[80vw] lg:w-[390px]"
      >
        <div className="border-b border-border px-5 py-4">
          <SheetTitle className="text-sm font-semibold">
            {editing ? "Edit profile" : "Your profile"}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {editing ? "Update your account details." : "Account, activity and settings."}
          </SheetDescription>
        </div>

        <div className="flex-1 space-y-5 px-5 py-5">
          {editing ? (
            <EditProfile user={user} onDone={() => setEditing(false)} />
          ) : (
            <>
              <ProfileCard user={user} />
              <Button size="sm" className="w-full" onClick={() => setEditing(true)}>
                <Pencil className="size-3.5" />
                Edit Profile
              </Button>
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Profile information
                </div>
                <ProfileDetails user={user} />
              </div>
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Activity
                </div>
                <ProfileStats stats={stats} />
              </div>
            </>
          )}
        </div>

        {!editing && (
          <div className="mt-auto space-y-1 border-t border-border p-3">
            <Separator className="mb-1 opacity-0" />
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={() => {
                close();
                navigate({ to: "/settings" });
              }}
            >
              <Settings className="size-4" />
              Account Settings
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="size-4" />
              Sign Out
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}