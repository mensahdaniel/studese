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
    }
  }, [searchParams]);

  const verifySubscription = async (sessionId: string) => {
    try {
      console.log('Getting current user...');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      console.log('Current user:', user);
      
      if (!user) {
        setMessage('Error: No user found. Please log in again.');
        setLoading(false);
        return;
      }

      // ✅ CHECK IF PROFILE EXISTS
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
        setMessage('🎉 Payment Successful! Welcome to Studese Pro!');
        
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
        setMessage('🎉 Payment Successful! Welcome to Studese Pro!');
        
        // Redirect to dashboard after 2 seconds
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
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
        {loading ? (
          <div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Verifying your payment...</p>
          </div>
        ) : (
          <div>
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {message.includes('Successful') ? 'Welcome to Studese Pro!' : 'Payment Issue'}
            </h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <div className="text-sm text-gray-500">
              Check browser console (F12) for debug info
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
