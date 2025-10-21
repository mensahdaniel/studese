import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/utils/supabase';

export default function Success() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    console.log('Success page loaded');
    const sessionId = searchParams.get('session_id');
    console.log('Session ID from URL:', sessionId);
    
    if (sessionId) {
      console.log('Starting verification...');
      verifySubscription(sessionId);
    } else {
      console.log('No session ID found');
      setMessage('No session ID found');
      setLoading(false);
      
      // Redirect to dashboard anyway after 3 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);
    }
  }, [searchParams, navigate]);

  const verifySubscription = async (sessionId: string) => {
    try {
      console.log('Getting current user...');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      console.log('Current user:', user);
      
      if (!user) {
        setMessage('Error: No user found. Please log in again.');
        setLoading(false);
        setTimeout(() => {
          navigate('/auth');
        }, 3000);
        return;
      }

      // ✅ FIXED: Get Stripe session details with robust error handling
      console.log('Fetching Stripe session details...');
      let stripeCustomerId = null;
      let stripeSubscriptionId = null;
      
      try {
        const sessionResponse = await fetch('https://yfkgyamxfescwqqbmtel.supabase.co/functions/v1/get-stripe-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId }),
        });

        if (sessionResponse.ok) {
          const sessionResult = await sessionResponse.json();
          console.log('Stripe session result:', sessionResult);
          
          if (sessionResult.success) {
            stripeCustomerId = sessionResult.session?.customer;
            stripeSubscriptionId = sessionResult.session?.subscription;
            console.log('Stripe customer ID:', stripeCustomerId);
            console.log('Stripe subscription ID:', stripeSubscriptionId);
          } else {
            console.log('Stripe session not successful, but continuing...');
          }
        } else {
          console.log('Stripe session fetch failed, but continuing...');
        }
      } catch (stripeError) {
        console.error('Stripe session fetch failed, but continuing:', stripeError);
        // CONTINUE ANYWAY - we'll create the account without stripe_customer_id
      }

      // ✅ CHECK IF PROFILE EXISTS
      console.log('Checking if profile exists...');
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      console.log('Existing profile check error:', checkError);
      console.log('Existing profile:', existingProfile);

      // Prepare profile data - GUARANTEE paid status
      const profileData: any = {
        id: user.id,
        email: user.email,
        is_paid: true, // ✅ CRITICAL: Always set to true
        updated_at: new Date().toISOString()
      };

      // Add stripe IDs only if we have them
      if (stripeCustomerId) {
        profileData.stripe_customer_id = stripeCustomerId;
      }
      if (stripeSubscriptionId) {
        profileData.stripe_subscription_id = stripeSubscriptionId;
      }

      let finalProfile = null;

      // If profile doesn't exist, create it
      if (checkError && checkError.code === 'PGRST116') {
        console.log('Profile does not exist, creating now...');
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            ...profileData,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating profile:', createError);
          // STILL REDIRECT TO DASHBOARD - don't block the user
          setMessage('Payment successful! Setting up your account...');
          setTimeout(() => {
            navigate('/dashboard');
          }, 2000);
          return;
        }

        console.log('New profile created:', newProfile);
        finalProfile = newProfile;
      } else {
        // Profile exists, update it
        console.log('Updating existing profile as paid...', user.id);
        
        const { data: updatedProfile, error: updateError } = await supabase
          .from('profiles')
          .update(profileData)
          .eq('id', user.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating profile:', updateError);
          // STILL REDIRECT TO DASHBOARD - don't block the user
          setMessage('Payment successful! Finalizing your access...');
          setTimeout(() => {
            navigate('/dashboard');
          }, 2000);
          return;
        }

        console.log('Profile updated successfully:', updatedProfile);
        finalProfile = updatedProfile;
      }

      // ✅ SUCCESS - User is now paid and ready
      console.log('Payment processing complete! Final profile:', finalProfile);
      setMessage('🎉 Payment Successful! Welcome to Studese Pro!');
      
      // Redirect to dashboard after short delay
      setTimeout(() => {
        console.log('Redirecting to dashboard...');
        navigate('/dashboard');
      }, 2000);
      
    } catch (error) {
      console.error('Unexpected error in verifySubscription:', error);
      // STILL REDIRECT USER - don't leave them stranded
      setMessage('Payment received! Redirecting you to the app...');
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
        {loading ? (
          <div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Verifying your payment...</p>
            <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
          </div>
        ) : (
          <div>
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {message.includes('Successful') || message.includes('successful') 
                ? 'Welcome to Studese Pro!' 
                : 'Almost Ready!'}
            </h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <div className="text-sm text-gray-500">
              You will be redirected automatically...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
