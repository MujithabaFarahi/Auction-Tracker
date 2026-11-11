import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Checking session...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3">
        <p>This account does not have auction admin access.</p>
        <Button variant="outline" onClick={() => void signOut()}>Sign out</Button>
      </div>
    );
  }

  return <>{children}</>;
}

export default RequireAdmin;
