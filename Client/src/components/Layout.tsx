import { ReactNode } from "react";
import Navigation from "./Navigation";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Fixed Sidebar */}
      <Navigation />

      {/* Main Content */}
      <main className="pt-16 lg:pt-0 lg:pl-64">
        {/* Add padding for mobile header and sidebar on large screens */}
        <div className="min-h-screen p-4">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
