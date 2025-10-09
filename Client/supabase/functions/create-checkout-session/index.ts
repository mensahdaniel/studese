import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

serve(async (req) => {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  try {
    const body = await req.json();
    const { userId, userEmail, priceId = 'price_1SFdcFDu5SBC5lwjxQQXyKsn' } = body;

    console.log('Creating Stripe session for:', userEmail);

    // Create Stripe checkout session - FIXED PORT 8080
    const session = await stripe.checkout.sessions.create({
      customer_email: userEmail,
      client_reference_id: userId,
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: 'http://localhost:8080/success?session_id={CHECKOUT_SESSION_ID}', // ← PORT 8080
      cancel_url: 'http://localhost:8080/pricing', // ← PORT 8080
      subscription_data: {
        trial_period_days: 7,
      },
    });

    console.log('Session created:', session.id, 'URL:', session.url);

    return new Response(JSON.stringify({ 
      success: true,
      sessionId: session.id,
      url: session.url
    }), { headers });

  } catch (error) {
    console.error('ERROR:', error);
    return new Response(JSON.stringify({ 
      error: error.message
    }), {
      status: 500,
      headers,
    });
  }
});
