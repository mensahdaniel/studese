import { Link, useLocation } from "react-router-dom";
import { 
  Home, 
  Calendar, 
  FileText, 
  CheckSquare, 
  MapPin, 
  BookOpen,
  Bell,
  Settings,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const Navigation = () => {
  const location = useLocation();
  
  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: Home },
    { name: "Notes", path: "/notes", icon: FileText },
    { name: "Events", path: "/events", icon: BookOpen },
    { name: "Calendar", path: "/calendar", icon: Calendar },
    { name: "Reminders", path: "/tasks", icon: Bell },
    { name: "Settings", path: "/settings", icon: Settings },
  ];

  const NavContent = () => (
    <nav className="flex flex-col space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 min-h-[44px] ${
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50 active:bg-accent"
            }`}
          >
            <Icon className="mr-3 h-4 w-4" />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop Sidebar - Fixed positioning */}
      <aside className="hidden lg:flex w-64 flex-col bg-card border-r border-border fixed left-0 top-0 h-full z-40">
        <div className="p-6">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">SE</span>
            </div>
            <span className="font-semibold text-lg">StudEse</span>
          </Link>
        </div>
        
        <div className="flex-1 px-4 pb-6">
          <NavContent />
        </div>
      </aside>

      {/* Mobile Header - Fixed and sticky */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center p-4 bg-card border-b border-border">
        {/* Hamburger Menu - Far Left */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] mr-2">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 px-0">
            <div className="px-6 py-6 border-b border-border">
              <Link to="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">SE</span>
                </div>
                <span className="font-semibold text-lg">StudEse</span>
              </Link>
            </div>
            <div className="px-4 py-6">
              <NavContent />
            </div>
          </SheetContent>
        </Sheet>

        {/* Centered Logo */}
        <div className="absolute left-1/2 transform -translate-x-1/2">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">SE</span>
            </div>
            <span className="font-semibold text-lg">StudEse</span>
          </Link>
        </div>
      </header>
    </>
  );
};

export default Navigation;