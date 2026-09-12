import { type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import {
  Globe,
  BookOpen,
  User,
  LogIn,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  path: string;
  requiresAuth?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "lexicon",
    label: "Lexicon",
    icon: <BookOpen className="h-5 w-5" />,
    path: "/",
  },
  {
    id: "my-brand-words",
    label: "My Brand Words",
    icon: <User className="h-5 w-5" />,
    path: "/my-brand-words",
    requiresAuth: true,
  },
  {
    id: "global-brand-words",
    label: "Global Brand Words",
    icon: <Globe className="h-5 w-5" />,
    path: "/global-brand-words",
  },
];

export default function AppLayout({ children }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, signOut } = useAuth();

  const currentNav = NAV_ITEMS.find((item) => item.path === location.pathname);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left Navigation Rail */}
      <nav className="w-[68px] flex flex-col items-center py-4 border-r border-border bg-surface shrink-0">
        {/* Logo */}
        <div className="mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
               style={{ backgroundColor: "#0F6CBD" }}>
            BL
          </div>
        </div>

        {/* Nav Items */}
        <div className="flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map((item) => {
            const isActive = currentNav?.id === item.id;
            const isDisabled = item.requiresAuth && !isAuthenticated;

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (!isDisabled) {
                    navigate(item.path);
                  }
                }}
                className={cn(
                  "group relative flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg transition-colors duration-150 w-full",
                  isActive
                    ? "bg-accent text-foreground"
                    : isDisabled
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
                title={isDisabled ? "Sign in required" : item.label}
              >
                {item.icon}
                <span className="text-[10px] leading-tight text-center whitespace-nowrap">
                  {item.label.split(" ")[0]}
                </span>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-foreground rounded-r" />
                )}
                {/* Tooltip */}
                <div className="absolute left-full ml-2 px-2.5 py-1 bg-popover border border-border rounded-lg shadow-md text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                  {item.label}
                  {isDisabled && " (sign in)"}
                </div>
              </button>
            );
          })}
        </div>

        {/* Account Control */}
        <div className="mt-auto pt-4 border-t border-border w-full flex flex-col items-center gap-2">
          {isAuthenticated && user ? (
            <div className="group relative w-full flex flex-col items-center">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold overflow-hidden">
                {user.image ? (
                  <img
                    src={user.image}
                    alt={user.name || "User"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  (user.name || user.email || "U").charAt(0).toUpperCase()
                )}
              </div>
              <div className="absolute left-full ml-2 bottom-0 px-2.5 py-1 bg-popover border border-border rounded-lg shadow-md text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                {user.name || user.email || "Account"}
              </div>
            </div>
          ) : (
            <button
              onClick={() => navigate("/auth?returnTo=/")}
              className="group relative w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title="Sign in"
            >
              <LogIn className="h-4 w-4" />
            </button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => {
              if (isAuthenticated) {
                signOut();
                navigate("/");
              }
            }}
            title={isAuthenticated ? "Sign out" : "Sign in"}
          >
            {isAuthenticated ? (
              <LogOut className="h-4 w-4" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
          </Button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">{children}</main>
    </div>
  );
}
