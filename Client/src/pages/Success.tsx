import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/utils/supabase';
import { CheckCircle, AlertCircle, Smartphone } from 'lucide-react';
import { isExpoWebView } from '@/utils/mobile';

export default function Success() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();

  const verifySubscription = useCallback(async (sessionId: string) => {
    try {
      console.log('Getting current user...');
      const { data: { user } } = await supabase.auth.getUser();

      console.log('Current user:', user);

      if (!user) {
        setMessage('Error: No user found. Please log in again.');
        setLoading(false);
        return;
      }

      // CHECK IF PROFILE EXISTS
      console.log('Checking if profile exists...');
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      console.log('Existing profile:', existingProfile);
      console.log('Profile check error:', checkError);

      // If profile doesn't exist, create it first
      if (checkError && checkError.code === 'PGRST116') {
        console.log('Profile does not exist, creating now...');
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            is_paid: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating profile:', createError);
          setMessage('Error creating user profile. Please contact support.');
          setLoading(false);
          return;
        }

        console.log('New profile created:', newProfile);
        setMessage('Payment Successful! Welcome to Studese Pro!');
        setIsSuccess(true);

        // Redirect to dashboard after delay
        setTimeout(() => {
          console.log('Redirecting to dashboard...');
          navigate('/dashboard');
        }, 2000);
        return;
      }

      console.log('Marking user as paid...', user.id);

      // MARK USER AS PAID IN THE DATABASE
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({
          is_paid: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select();

      console.log('Update result:', data);
      console.log('Update error:', updateError);

      if (updateError) {
        console.error('Database error:', updateError);
        setMessage('Payment verified but error updating account. Please contact support.');
      } else {
        console.log('User marked as paid successfully! Redirecting...');
        setMessage('Payment Successful! Welcome to Studese Pro!');
        setIsSuccess(true);

        // Redirect to dashboard after delay
        setTimeout(() => {
          console.log('Redirecting to dashboard...');
          navigate('/dashboard');
        }, 2000);
      }

    } catch (error) {
      console.error('Error in verifySubscription:', error);
      setMessage('Error verifying payment. Please contact support.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    console.log('Success page loaded');
    console.log('Running in native app:', isExpoWebView());
    const sessionId = searchParams.get('session_id');
    console.log('Session ID from URL:', sessionId);

    if (sessionId) {
      console.log('Starting verification...');
      verifySubscription(sessionId);
    } else {
      console.log('No session ID found');
      setMessage('No session ID found');
      setLoading(false);
    }
  }, [searchParams, verifySubscription]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
        {loading ? (
          <div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300">Verifying your payment...</p>
            {isExpoWebView() && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Smartphone className="h-4 w-4" />
                <span>Returning to Studese app...</span>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="mb-4 flex justify-center">
              {isSuccess ? (
                <CheckCircle className="h-16 w-16 text-green-500" />
              ) : (
                <AlertCircle className="h-16 w-16 text-yellow-500" />
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {isSuccess ? 'Welcome to Studese Pro!' : 'Payment Issue'}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-6">{message}</p>

            {isSuccess && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Redirecting you to your dashboard...
              </p>
            )}

            {!isSuccess && (
              <button
                onClick={() => navigate('/pricing')}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            )}

            {/* Debug info - only in development */}
            {import.meta.env.DEV && (
              <div className="mt-6 text-xs text-gray-400 dark:text-gray-500">
                <p>Environment: {isExpoWebView() ? 'Native App' : 'Web Browser'}</p>
                <p>Check browser console (F12) for debug info</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
