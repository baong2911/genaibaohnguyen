import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, Route } from "@/components/Router";
import {
  User,
  LogOut,
  MessageSquare,
  ClipboardList,
  GitBranch,
  Layers,
} from "lucide-react";

interface UserMenuProps {
  onSignInClick?: () => void;
}

const NAV_ITEMS: { label: string; route: Route; icon: React.ReactNode }[] = [
  { label: "Chat",          route: "home",      icon: <MessageSquare className="w-4 h-4 mr-2" /> },
  { label: "Log",           route: "log",       icon: <ClipboardList  className="w-4 h-4 mr-2" /> },
  { label: "Summarize Note",route: "summarize", icon: <ClipboardList  className="w-4 h-4 mr-2" /> },
  { label: "Mind Map",      route: "mindmap",   icon: <GitBranch      className="w-4 h-4 mr-2" /> },
  { label: "Flash Cards",   route: "flashcard", icon: <Layers         className="w-4 h-4 mr-2" /> },
];

export const UserMenu = ({ onSignInClick }: UserMenuProps) => {
  const { user, isAuthenticated, logout } = useAuth();
  const { navigateTo, currentRoute } = useRouter();

  if (!isAuthenticated || !user) {
    return (
      <Button variant="outline" onClick={onSignInClick} disabled={!onSignInClick}>
        <User className="w-4 h-4 mr-2" />
        Sign In
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <User className="w-4 h-4" />
          {user.username}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {NAV_ITEMS.filter((item) => item.route !== currentRoute).map((item) => (
          <DropdownMenuItem key={item.route} onClick={() => navigateTo(item.route)}>
            {item.icon}
            {item.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-destructive">
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
