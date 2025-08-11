import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Calendar, FileText, CheckSquare, MapPin } from "lucide-react";
import heroImage from "@/assets/hero-dashboard.jpg";

const Landing = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">SE</span>
            </div>
            <span className="font-semibold text-xl">StudEse</span>
          </div>
          
          <Link to="/login">
            <Button>Get Started</Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div className="space-y-6">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
                Simplify Your <br />
                <span className="text-primary">Campus Life</span>
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground max-w-lg leading-relaxed">
                A minimalist productivity platform designed to help university and college students 
                organize their academic and personal lives in one distraction-free space. ✨
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/login">
                <Button size="lg" className="w-full sm:w-auto">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              
              <Link to="/dashboard">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  View Dashboard
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border bg-card">
              <div className="bg-gradient-to-br from-muted to-accent p-8 h-96 flex items-center justify-center">
                <div className="space-y-4 w-full max-w-sm">
                  <div className="bg-card rounded-lg p-4 border border-border shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <div className="text-sm font-medium">Today's Schedule</div>
                    </div>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div>• 9:00 AM - Computer Science</div>
                      <div>• 2:00 PM - Project Meeting</div>
                      <div>• 6:00 PM - Study Group</div>
                    </div>
                  </div>
                  
                  <div className="bg-card rounded-lg p-4 border border-border shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-success rounded-full"></div>
                      <div className="text-sm font-medium">Quick Notes</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Assignment deadline Friday...
                    </div>
                  </div>
                  
                  <div className="bg-card rounded-lg p-4 border border-border shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-warning rounded-full"></div>
                      <div className="text-sm font-medium">Upcoming Tasks</div>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div>✓ Complete lab report</div>
                      <div>○ Review for midterm</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to stay organized</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Manage your academic and personal life with our clean, focused tools designed specifically for students.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: Calendar,
              title: "Smart Calendar",
              description: "Keep track of classes, deadlines, and campus events in one unified calendar view."
            },
            {
              icon: FileText,
              title: "Quick Notes",
              description: "Capture ideas, lecture notes, and important information with our distraction-free editor."
            },
            {
              icon: CheckSquare,
              title: "Task Management",
              description: "Stay on top of assignments and personal tasks with intuitive to-do lists and tracking."
            },
            {
              icon: MapPin,
              title: "Campus Events",
              description: "Discover and stay updated on university events, activities, and opportunities."
            }
          ].map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="border-border hover:shadow-lg transition-shadow">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to get organized?
            </h2>
            <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
              Join thousands of students who have simplified their campus life with StudEse.
            </p>
            <Link to="/login">
              <Button size="lg" variant="secondary">
                Start Your Journey
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">SE</span>
                </div>
                <span className="font-semibold text-lg">StudEse</span>
              </div>
              <p className="text-muted-foreground text-sm">
                Simplifying campus life for students worldwide.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Platform</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/dashboard" className="hover:text-foreground">Dashboard</Link></li>
                <li><Link to="/calendar" className="hover:text-foreground">Calendar</Link></li>
                <li><Link to="/notes" className="hover:text-foreground">Notes</Link></li>
                <li><Link to="/tasks" className="hover:text-foreground">Tasks</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Help Center</a></li>
                <li><a href="#" className="hover:text-foreground">Contact Us</a></li>
                <li><a href="#" className="hover:text-foreground">Status</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground">Terms of Service</a></li>
                <li><a href="#" className="hover:text-foreground">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border mt-8 pt-8 space-y-4">
            <div className="text-center">
              <Card className="inline-block bg-muted/50 border-warning/20">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Note:</span> This is a demo version. The full StudEse web app is currently under development and will launch soon.
                  </p>
                </CardContent>
              </Card>
            </div>
            <div className="text-center text-sm text-muted-foreground">
              <p>&copy; 2024 StudEse. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;