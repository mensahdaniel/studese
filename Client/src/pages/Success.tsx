import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/utils/supabase'; // FIXED IMPORT PATH
import { isProUser } from '@/utils/subscription';

export default function Success() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    
    if (sessionId) {
      verifySubscription(sessionId);
    } else {
      setMessage('No session ID found');
      setLoading(false);
    }
  }, [searchParams]);

  const verifySubscription = async (sessionId: string) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Force refresh the subscription status
      await checkAndUpdateSubscription(user.id);
      
      setMessage('🎉 Payment Successful! Welcome to Studese Pro!');
      
      // Redirect to dashboard after 3 seconds
      setTimeout(() => {
        window.location.href = '/dashboard'; // Full page reload to refresh state
      }, 3000);
      
    } catch (error) {
      setMessage('Error verifying payment. Please contact support.');
    } finally {
      setLoading(false);
    }
  };

  const checkAndUpdateSubscription = async (userId: string) => {
    // This forces the webhook to process or checks subscription status
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing']);
    
    return subscriptions && subscriptions.length > 0;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
        {loading ? (
          <div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Verifying your payment and activating Pro features...</p>
          </div>
        ) : (
          <div>
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Studese Pro!</h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <Link 
              to="/dashboard" 
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              Go to Dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
