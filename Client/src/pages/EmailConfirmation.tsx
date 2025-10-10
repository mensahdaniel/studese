import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Mail, ArrowRight } from "lucide-react";

const EmailConfirmation = () => {
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
        </div>

        {/* Email Confirmation Card */}
        <Card className="border-border">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Check your email! 📧</CardTitle>
            <CardDescription className="text-base">
              We've sent you a confirmation link
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Please check your email inbox and click the confirmation link to
                verify your account.
              </p>

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-left">
                <h3 className="font-semibold text-sm text-blue-900 dark:text-blue-100 mb-2">
                  Next Steps:
                </h3>
                <ol className="text-xs text-blue-700 dark:text-blue-300 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="font-semibold">1.</span>
                    <span>Open the confirmation email we just sent you</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-semibold">2.</span>
                    <span>Click the confirmation link in the email</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-semibold">3.</span>
                    <span>Come back and sign in to continue</span>
                  </li>
                </ol>
              </div>

              <div className="pt-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Can't find the email? Check your spam folder.
                </p>

                <Link to="/login" className="block">
                  <Button className="w-full" variant="default">
                    Go to Login
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Need help?{" "}
          <Button variant="link" className="p-0 h-auto text-xs font-normal">
            Contact Support
          </Button>
        </p>
      </div>
    </div>
  );
};

export default EmailConfirmation;
