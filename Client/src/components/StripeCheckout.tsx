import React, { useState } from 'react';
import { supabase } from "@/utils/supabase";

export default function StripeCheckout() {
  const [loading, setLoading] = useState(false);

  const handleSubscription = async () => {
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Please log in to subscribe');
        return;
      }

      console.log('Starting annual subscription for:', user.email);

      const response = await fetch('https://yfkgyamxfescwqqbmtel.supabase.co/functions/v1/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
          priceId: 'price_1SFdcFDu5SBC5lwjxQQXyKsn',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Response:', result);

      if (result.sessionId && result.url) {
        // NEW APPROACH: Redirect directly to Stripe Checkout URL
        window.location.href = result.url;
      } else if (result.sessionId) {
        // Fallback: Construct the URL manually
        window.location.href = `https://checkout.stripe.com/c/pay/${result.sessionId}`;
      } else {
        throw new Error(result.error || 'No session data received');
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4 text-center">Upgrade to Studese Pro</h2>
        <div className="mb-6 text-center">
          <p className="text-3xl font-bold text-gray-900">$6.99 CAD</p>
          <p className="text-gray-600">per year</p>
          <p className="text-sm text-green-600 mt-2">✓ 7-day free trial</p>
          <p className="text-sm text-gray-600">✓ Cancel anytime</p>
          <p className="text-xs text-blue-600 mt-1">🔥 Less than $0.60 per month!</p>
        </div>
        <button
          onClick={handleSubscription}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold text-lg"
        >
          {loading ? 'Processing...' : 'Start 7-Day Free Trial'}
        </button>
        
        {/* Test card info */}
        <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
          <p className="text-sm font-semibold text-yellow-800">Test Card:</p>
          <p className="text-sm text-yellow-700">4242 4242 4242 4242</p>
          <p className="text-xs text-yellow-600">Any future date, CVC, ZIP</p>
        </div>
      </div>
    </div>
  );
}
