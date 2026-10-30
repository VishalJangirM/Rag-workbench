import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { initials, useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UserProfile } from "@/types";

export function EditProfile({
  user,
  onDone,
}: {
  user: UserProfile;
  onDone: () => void;
}) {
  const { updateProfile } = useAuth();
  const [draft, setDraft] = useState<UserProfile>(user);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const pickAvatar = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set("avatarUrl", String(reader.result));
    reader.readAsDataURL(file);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await updateProfile({ ...draft, username: draft.username.replace(/^@/, "") });
      toast.success("Profile updated");
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="group relative rounded-full"
          aria-label="Change profile picture"
        >
          <Avatar className="size-20 ring-2 ring-border ring-offset-2 ring-offset-background">
            {draft.avatarUrl ? <AvatarImage src={draft.avatarUrl} alt={draft.fullName} /> : null}
            <AvatarFallback className="bg-secondary text-xl font-semibold text-secondary-foreground">
              {initials(draft.fullName || "?")}
            </AvatarFallback>
          </Avatar>
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70 opacity-0 transition-opacity group-hover:opacity-100">
            <Camera className="size-5 text-foreground" />
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => pickAvatar(event.target.files?.[0])}
        />
        {draft.avatarUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 h-7 text-xs text-muted-foreground"
            onClick={() => set("avatarUrl", null)}
          >
            Remove picture
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="edit-name" className="text-xs">Full name</Label>
          <Input
            id="edit-name"
            value={draft.fullName}
            onChange={(event) => set("fullName", event.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-username" className="text-xs">Username</Label>
          <Input
            id="edit-username"
            value={draft.username}
            onChange={(event) => set("username", event.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-email" className="text-xs">Email</Label>
          <Input
            id="edit-email"
            type="email"
            value={draft.email}
            onChange={(event) => set("email", event.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-role" className="text-xs">Role</Label>
          <Input
            id="edit-role"
            value={draft.role}
            onChange={(event) => set("role", event.target.value)}
            required
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" className="flex-1" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
