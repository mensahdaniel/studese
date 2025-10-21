import { ReactNode } from "react";

interface SimpleLayoutProps {
  children: ReactNode;
}

const SimpleLayout = ({ children }: SimpleLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      {/* Simple header for public pages */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <a href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">SE</span>
              </div>
              <span className="font-semibold text-xl">StudEse</span>
            </a>
            <a 
              href="/login" 
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Sign In
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {children}
      </main>
    </div>
  );
};

export default SimpleLayout;
