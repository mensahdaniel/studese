import { supabase } from "./supabase";

export const checkSubscription = async (userId: string) => {
  try {
    console.log('🔍 Checking REAL subscription for user:', userId);
    
    // REAL DATABASE QUERY - check if user has active subscription
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing'])
      .single();

    if (error) {
      console.log('No active subscription found:', error.message);
      return {
        isPro: false,
        subscription: null
      };
    }

    console.log('✅ REAL Subscription found:', subscription);
    return {
      isPro: !!subscription,
      subscription
    };
    
  } catch (error) {
    console.error('Subscription check failed:', error);
    return {
      isPro: false,
      subscription: null
    };
  }
};

export const isProUser = async (userId: string) => {
  const { isPro } = await checkSubscription(userId);
  return isPro;
};
