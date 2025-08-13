import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/utils/supabase";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || (isSignUp && !username)) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      if (isSignUp) {
        // Sign-up
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { username },
          },
        });
        if (error) throw error;
        toast({
          title: "Account created!",
          description: "Check your email to confirm your account.",
        });
        setIsSignUp(false); // Switch back to sign-in form
      } else {
        // Sign-in
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast({
          title: "Welcome back! 🎉",
          description: "You've been successfully logged in.",
        });
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center space-x-2 group">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold">SE</span>
            </div>
            <span className="font-semibold text-2xl group-hover:text-primary transition-colors">StudEse</span>
          </Link>
          <p className="text-muted-foreground">Simplify your campus life</p>
        </div>

        {/* Login/Sign-up Card */}
        <Card className="border-border">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl">{isSignUp ? "Create an Account" : "Welcome back 👋"}</CardTitle>
            <CardDescription>
              {isSignUp ? "Sign up to start organizing your campus life" : "Enter your credentials to access your productivity dashboard"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Choose a username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
                onClick={handleSubmit}
              >
                {isLoading ? (isSignUp ? "Signing up..." : "Signing in...") : (isSignUp ? "Sign Up" : "Sign In")}
              </Button>
            </div>

            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                <Button
                  variant="link"
                  className="p-0 h-auto font-normal"
                  onClick={() => setIsSignUp(!isSignUp)}
                >
                  {isSignUp ? "Sign in" : "Sign up"}
                </Button>
              </p>
              
              {!isSignUp && (
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-xs font-normal text-muted-foreground"
                  onClick={async () => {
                    if (!email) {
                      toast({
                        title: "Error",
                        description: "Please enter your email to reset password.",
                        variant: "destructive",
                      });
                      return;
                    }
                    try {
                      await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: `${window.location.origin}/reset-password`,
                      });
                      toast({
                        title: "Password reset email sent",
                        description: "Check your email for a password reset link.",
                      });
                    } catch (error: any) {
                      toast({
                        title: "Error",
                        description: error.message || "Failed to send reset email.",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  Forgot your password?
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          By {isSignUp ? "signing up" : "signing in"}, you agree to our{" "}
          <Button variant="link" className="p-0 h-auto text-xs font-normal">
            Terms of Service
          </Button>{" "}
          and{" "}
          <Button variant="link" className="p-0 h-auto text-xs font-normal">
            Privacy Policy
          </Button>
        </p>
      </div>
    </div>
  );
};

export default Login;