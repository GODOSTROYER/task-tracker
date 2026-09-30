"use client";

import { useState } from "react";
import { useUser } from "@/lib/contexts/AuthContext";
import { updateProfile } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User as UserIcon, Lock, CheckCircle2 } from "lucide-react";

export default function SettingsPage() {
  const { user } = useUser();
  const [name, setName] = useState(user?.name || "");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (password && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password && password.length < 8) {
        setError("Password must be at least 8 characters");
        return;
    }

    setLoading(true);
    try {
      await updateProfile({
        name: name !== user?.name ? name : undefined,
        password: password || undefined,
        currentPassword: password ? currentPassword : undefined,
      });

       setSuccess(true);
       setPassword("");
       setCurrentPassword("");
       setConfirmPassword("");



    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 md:p-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Account Settings</h1>
        <p className="text-gray-500 mt-2">Manage your profile and security preferences.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Profile Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900">
              <UserIcon className="h-5 w-5 text-blue-500" />
              Profile Information
            </h2>
            
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="max-w-md"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                value={user?.email || ""}
                disabled
                className="max-w-md bg-gray-50 text-gray-500"
              />
              <p className="text-xs text-gray-400">Email cannot be changed.</p>
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* Security Section */}
          <div className="space-y-4">
             <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900">
              <Lock className="h-5 w-5 text-blue-500" />
              Security
            </h2>
            
            <div className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input id="currentPassword" type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required={!!password} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Leave blank to keep current"
                  />
                </div>
                
                {password && (
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                      />
                    </div>
                )}
            </div>
          </div>

          <div className="pt-4 flex items-center gap-4">
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 min-w-[120px]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
            
            {success && (
                <div className="flex items-center gap-2 text-green-600 text-sm font-medium animate-in fade-in slide-in-from-left-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Updates saved successfully!
                </div>
            )}
             {error && (
                <div className="text-red-500 text-sm font-medium animate-in fade-in">
                    {error}
                </div>
            )}
          </div>

        </form>
      </div>
    </div>
  );
}
