import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, Crown } from "lucide-react";
import { supabase } from "@/utils/supabase";

export default function StripeCheckout() {
  const [loading, setLoading] = useState(false);

  const handleSubscription = async () => {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        alert("Please log in to subscribe");
        setLoading(false);
        return;
      }

      console.log("Starting annual subscription for:", user.email);

      // ✅ CRITICAL FIX: Use window.location.origin to guarantee correct URL
      const currentOrigin = window.location.origin;
      console.log("Current origin:", currentOrigin);

      const response = await fetch(
        "https://yfkgyamxfescwqqbmtel.supabase.co/functions/v1/create-checkout-session",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: user.id,
            userEmail: user.email,
            priceId: "price_1SH7EMDu5SBC5lwj9cB3yLtz",
            // ✅ FIXED: Use dynamic origin instead of BASE_URL
            successUrl: `${currentOrigin}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${currentOrigin}/pricing`,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("Response:", result);

      if (result.sessionId && result.url) {
        window.location.href = result.url;
      } else if (result.sessionId) {
        window.location.href = `https://checkout.stripe.com/c/pay/${result.sessionId}`;
      } else {
        throw new Error(result.error || "No session data received");
      }
    } catch (error: any) {
      console.error("Subscription error:", error);
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start organized today. One plan with everything you need to succeed
            in your studies.
          </p>
        </div>

        {/* Pricing Card */}
        <div className="max-w-md mx-auto">
          <Card className="border-2 border-primary shadow-xl">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl flex items-center justify-center gap-2">
                <Crown className="h-6 w-6 text-yellow-500" />
                Studese Pro
              </CardTitle>
              <CardDescription>
                Everything you need to organize your campus life
              </CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">$6.99</span>
                <span className="text-muted-foreground">/year</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Less than $0.60 per month!
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Features */}
              <div className="space-y-3">
                {[
                  "Full dashboard access",
                  "Unlimited notes & tasks",
                  "Smart calendar integration",
                  "Priority email support",
                  "Early access to new features",
                  "7-day free trial included",
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-500" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              {/* Subscribe Button */}
              <Button
                onClick={handleSubscription}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading
                  ? "Redirecting to checkout..."
                  : "Get Started with 7-Day Free Trial"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto mt-16">
          <h2 className="text-2xl font-bold text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">
                How does the free trial work?
              </h3>
              <p className="text-sm text-muted-foreground">
                Start with 7 days free. If you don't cancel, your yearly
                subscription begins automatically.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">
                What happens after payment?
              </h3>
              <p className="text-sm text-muted-foreground">
                You'll be redirected to your dashboard with full access to all
                Studese Pro features.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Why subscription only?</h3>
              <p className="text-sm text-muted-foreground">
                We focus on providing the best experience without ads. Your
                payment ensures continuous development and premium support.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Can I get a refund?</h3>
              <p className="text-sm text-muted-foreground">
                Yes! We offer a 30-day money-back guarantee if you're not
                satisfied with Studese Pro.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
