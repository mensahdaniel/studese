import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BASE_URL } from "@/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Crown, Mail, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/utils/supabase";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // Auto-set to signup mode if URL has ?mode=signup
  useEffect(() => {
    const signupMode = searchParams.get("mode") === "signup";
    if (signupMode) {
      setIsSignUp(true);
    }
  }, [searchParams]);

  // NEW FUNCTION: Check if user has paid
  const checkPaymentStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_paid")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error checking payment status:", error);
        return false;
      }

      return data?.is_paid || false;
    } catch (error) {
      console.error("Error checking payment status:", error);
      return false;
    }
  };

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
            data: { username },
            emailRedirectTo: `${BASE_URL}/login`,
          },
        });
        if (error) throw error;

        // Show success state instead of navigating
        setSignupSuccess(true);
        toast({
          title: "Account created!",
          description: "Please check your email to confirm your account.",
        });
        return;

      } else {
        // Sign-in
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        // CHECK PAYMENT STATUS AFTER LOGIN
        if (data.user) {
          const isPaid = await checkPaymentStatus(data.user.id);

          if (isPaid) {
            // User has paid - go to dashboard
            toast({
              title: "Welcome back! ",
              description: "You've been successfully logged in.",
            });
            navigate("/dashboard");
          } else {
            // User hasn't paid - go to pricing page
            toast({
              title: "Welcome back!",
              description:
                "Please complete your subscription to access Studese Pro.",
            });
            navigate("/pricing");
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show email confirmation screen after successful signup
  if (signupSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <Link to="/" className="inline-flex items-center space-x-2 group">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold">SE</span>
              </div>
              <span className="font-semibold text-2xl group-hover:text-primary transition-colors">StudEse</span>
            </Link>
          </div>

          <Card className="border-border">
            <CardHeader className="space-y-1 text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                <Mail className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-2xl">Check your email!</CardTitle>
              <CardDescription>
                We've sent a confirmation link to
              </CardDescription>
              <p className="font-medium text-foreground">{email}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Click the link in your email to confirm your account
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    After confirming, you can sign in and subscribe to Studese Pro
                  </p>
                </div>
              </div>

              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Didn't receive the email? Check your spam folder.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSignupSuccess(false);
                    setIsSignUp(false);
                  }}
                  className="w-full"
                >
                  Back to Sign In
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center space-x-2 group">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold">SE</span>
            </div>
            <span className="font-semibold text-2xl group-hover:text-primary transition-colors">
              StudEse
            </span>
          </Link>
          <p className="text-muted-foreground">
            {isSignUp
              ? "Create your account to get started"
              : "Sign in to access Studese Pro"}
          </p>
        </div>

        {/* Login/Sign-up Card */}
        <Card className="border-border">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl">{isSignUp ? "Create Account" : "Welcome back "}</CardTitle>
            <CardDescription>
              {isSignUp
                ? "Sign up to start your journey with Studese Pro"
                : "Enter your credentials to access your account"}
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
                    placeholder={
                      isSignUp ? "Create a password" : "Enter your password"
                    }
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
                {isLoading
                  ? isSignUp
                    ? "Creating account..."
                    : "Signing in..."
                  : isSignUp
                  ? "Create Account"
                  : "Sign In"}
              </Button>
            </div>

            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                {isSignUp
                  ? "Already have an account?"
                  : "Don't have an account?"}{" "}
                <Button
                  variant="link"
                  className="p-0 h-auto font-normal"
                  onClick={() => setIsSignUp(!isSignUp)}
                >
                  {isSignUp ? "Sign in" : "Sign up"}
                </Button>
              </p>

              {/* UPDATED MESSAGE - More accurate for paywall-first model */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-blue-800 text-sm">
                  <Crown className="h-4 w-4" />
                  <span className="font-medium">Payment Required</span>
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  {isSignUp
                    ? "Create account → Subscribe → Access all features"
                    : "Login → Complete subscription → Access all features"
                  }
                </p>
              </div>
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
