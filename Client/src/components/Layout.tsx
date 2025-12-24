import { Outlet } from "react-router-dom";
import Navigation from "./Navigation";

const Layout = () => {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Fixed Sidebar */}
      <Navigation />

      {/* Main Content */}
      <main className="pt-16 lg:pt-0 lg:pl-64">
        {/* Add padding for mobile header and sidebar on large screens */}
        <div className="min-h-screen p-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
