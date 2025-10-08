import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Crown } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const Pricing = () => {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const stripe = await stripePromise;
      if (!stripe) throw new Error("Stripe failed to load");

      // Create checkout session
      const response = await fetch("/.netlify/functions/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          priceId: "price_1SFdcFDu5SBC5lwjxQQXyKsn", // ✅ YOUR ACTUAL PRICE ID
          successUrl: `${window.location.origin}/success`,
          cancelUrl: `${window.location.origin}/pricing`,
        }),
      });

      const { sessionId } = await response.json();
      
      // Redirect to Stripe Checkout
      const { error } = await stripe.redirectToCheckout({ sessionId });
      if (error) throw error;
      
    } catch (error) {
      console.error("Error:", error);
      alert("Error starting checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Simple, Transparent Pricing</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start organized today. One plan with everything you need to succeed in your studies.
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
              <CardDescription>Everything you need to organize your campus life</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">$6.99</span>
                <span className="text-muted-foreground">/year</span>
              </div>
              <p className="text-sm text-muted-foreground">Less than $0.60 per month!</p>
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
                  "7-day free trial included"
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-500" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              {/* Subscribe Button */}
              <Button 
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? "Redirecting to checkout..." : "Get Started with 7-Day Free Trial"}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                No credit card required for free trial. Cancel anytime.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto mt-16">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">How does the free trial work?</h3>
              <p className="text-sm text-muted-foreground">
                Start with 7 days free. If you don't cancel, your yearly subscription begins automatically.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">What happens after payment?</h3>
              <p className="text-sm text-muted-foreground">
                Your account is created automatically. You'll then login with the email you used for payment.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Why subscription only?</h3>
              <p className="text-sm text-muted-foreground">
                We focus on providing the best experience without ads. Your payment ensures continuous development and premium support.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Can I get a refund?</h3>
              <p className="text-sm text-muted-foreground">
                Yes! We offer a 30-day money-back guarantee if you're not satisfied with Studese Pro.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
