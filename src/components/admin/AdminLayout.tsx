import { Link, NavLink, Outlet } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/theme/ThemeToggle";

const linkClassName =
  "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";

const activeClassName = "text-foreground";

function AdminLayout() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/admin/setup" className="text-lg font-semibold">
            Auction Admin
          </Link>
          <nav className="flex items-center gap-4">
            <NavLink
              to="/auction/view"
              className={({ isActive }) =>
                `${linkClassName} ${isActive ? activeClassName : ""}`
              }
            >
              View
            </NavLink>{" "}
            <NavLink
              to="/admin/setup"
              className={({ isActive }) =>
                `${linkClassName} ${isActive ? activeClassName : ""}`
              }
            >
              Setup
            </NavLink>
            <NavLink
              to="/admin/auction"
              className={({ isActive }) =>
                `${linkClassName} ${isActive ? activeClassName : ""}`
              }
            >
              Auction
            </NavLink>
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              Sign out
            </Button>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
