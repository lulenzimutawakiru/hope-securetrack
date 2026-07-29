"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { FileUpload } from "@/components/ui/file-upload";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";

export default function ProfileSettingsPage() {
  const { auth, loading: authLoading } = useUser();
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    avatar_url: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (auth) {
      setProfile({
        first_name: auth.profile.first_name,
        last_name: auth.profile.last_name,
        phone: auth.profile.phone ?? "",
        avatar_url: (auth.profile as { avatar_url?: string }).avatar_url ?? "",
      });
    }
  }, [auth]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("user_profiles")
        .update({
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone || null,
          avatar_url: profile.avatar_url || null,
        })
        .eq("id", auth.profile.id);
      if (error) throw error;
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="My Profile"
        description="Personal account details and profile photo"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/settings">Hub</Link>
          </Button>
        }
      />

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
          <CardDescription>Update your photo and personal information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <FileUpload
              bucket="avatars"
              category="avatar"
              folder="profiles"
              entityTable="user_profiles"
              entityId={auth?.profile.id}
              entityField="avatar_url"
              value={profile.avatar_url}
              preview
              label="Profile picture"
              hint="Square image recommended · max 5 MB"
              onUploaded={async (r) => {
                setProfile((p) => ({ ...p, avatar_url: r.publicUrl }));
                if (auth) {
                  try {
                    // Use dedicated helper (upserts fixed path avatar)
                    // Already uploaded via FileUpload — persist URL
                    await createClient()
                      .from("user_profiles")
                      .update({ avatar_url: r.publicUrl })
                      .eq("id", auth.profile.id);
                  } catch {
                    /* ok */
                  }
                }
              }}
              onCleared={() => setProfile((p) => ({ ...p, avatar_url: "" }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  value={profile.first_name}
                  onChange={(e) =>
                    setProfile({ ...profile, first_name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  value={profile.last_name}
                  onChange={(e) =>
                    setProfile({ ...profile, last_name: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={auth?.profile.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input value={auth?.profile.roles?.name ?? ""} disabled />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
