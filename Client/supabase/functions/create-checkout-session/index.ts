import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno';

serve(async (req) => {
  // Add CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  try {
    // Check for Stripe secret key first
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY is not set');
      return new Response(JSON.stringify({
        error: 'Server configuration error',
        details: 'STRIPE_SECRET_KEY environment variable is not set'
      }), {
        status: 500,
        headers,
      });
    }

    // Validate the key format
    if (!stripeSecretKey.startsWith('sk_test_') && !stripeSecretKey.startsWith('sk_live_')) {
      console.error('STRIPE_SECRET_KEY has invalid format');
      return new Response(JSON.stringify({
        error: 'Server configuration error',
        details: 'STRIPE_SECRET_KEY has invalid format. Must start with sk_test_ or sk_live_'
      }), {
        status: 500,
        headers,
      });
    }

    console.log('Stripe key validated, format:', stripeSecretKey.substring(0, 8) + '...');

    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(JSON.stringify({
        error: 'Invalid request',
        details: 'Failed to parse JSON body'
      }), {
        status: 400,
        headers,
      });
    }

    const { userId, userEmail, priceId: requestPriceId, successUrl, cancelUrl } = body;

    // Use price ID from request, or fall back to environment variable
    const priceId = requestPriceId || Deno.env.get('STRIPE_PRO_PRICE_ID');

    console.log('Request received:', {
      userId: userId ? 'present' : 'missing',
      userEmail: userEmail ? 'present' : 'missing',
      priceId: priceId || 'missing',
      priceIdSource: requestPriceId ? 'request' : 'environment',
      successUrl: successUrl ? 'present' : 'missing',
      cancelUrl: cancelUrl ? 'present' : 'missing',
    });

    // Validate required fields
    if (!userId || !userEmail || !priceId) {
      console.error('Missing required fields');
      return new Response(JSON.stringify({
        error: 'Missing required fields',
        details: {
          userId: !userId ? 'missing' : 'ok',
          userEmail: !userEmail ? 'missing' : 'ok',
          priceId: !priceId ? 'missing (not in request and STRIPE_PRO_PRICE_ID not set)' : 'ok',
        }
      }), {
        status: 400,
        headers,
      });
    }

    // Use URLs from request if provided, otherwise fallback to production URL
    const frontendUrl = 'https://www.studese.com';
    const finalSuccessUrl = successUrl || `${frontendUrl}/success?session_id={CHECKOUT_SESSION_ID}`;
    const finalCancelUrl = cancelUrl || `${frontendUrl}/pricing`;

    console.log('Creating checkout session for:', userEmail);
    console.log('Price ID:', priceId);
    console.log('Success URL:', finalSuccessUrl);
    console.log('Cancel URL:', finalCancelUrl);

    // Verify the price exists first
    try {
      const price = await stripe.prices.retrieve(priceId);
      console.log('Price verified:', price.id, 'Active:', price.active);

      if (!price.active) {
        return new Response(JSON.stringify({
          error: 'Invalid price',
          details: 'The specified price is not active in Stripe'
        }), {
          status: 400,
          headers,
        });
      }
    } catch (priceError) {
      console.error('Failed to retrieve price:', priceError);
      return new Response(JSON.stringify({
        error: 'Invalid price ID',
        details: `Price ${priceId} not found in Stripe. Please check your Stripe dashboard.`
      }), {
        status: 400,
        headers,
      });
    }

    // Create Stripe checkout session
    console.log('Creating Stripe checkout session...');

    const session = await stripe.checkout.sessions.create({
      customer_email: userEmail,
      client_reference_id: userId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      subscription_data: {
        trial_period_days: 7,
      },
    });

    console.log('Session created successfully:', session.id);
    console.log('Session URL:', session.url);

    return new Response(JSON.stringify({
      sessionId: session.id,
      url: session.url
    }), {
      headers,
    });

  } catch (error) {
    console.error('Unexpected error in create-checkout-session:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('Error message:', errorMessage);
    console.error('Error stack:', errorStack);

    return new Response(JSON.stringify({
      error: 'Failed to create checkout session',
      details: errorMessage,
    }), {
      status: 500,
      headers,
    });
  }
});
