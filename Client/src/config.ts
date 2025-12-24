// src/config.ts

// Environment detection
export const IS_DEV = import.meta.env.DEV;
export const IS_PROD = import.meta.env.PROD;
export const APP_ENV = import.meta.env.VITE_APP_ENV || 'development';

// Base URLs - uses environment variables first, then falls back to auto-detection
export const BASE_URL = import.meta.env.VITE_BASE_URL || (IS_PROD
  ? 'https://studese.vercel.app'
  : 'http://localhost:8080');

// API URLs
export const API_BASE_URL = BASE_URL;

// Stripe URLs
export const STRIPE_SUCCESS_URL = `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`;
export const STRIPE_CANCEL_URL = `${BASE_URL}/pricing`;

// Supabase Auth URLs
export const AUTH_REDIRECT_URL = BASE_URL;
export const AUTH_CALLBACK_URL = `${BASE_URL}/auth/callback`;

// Export all config
export const CONFIG = {
  IS_DEV,
  IS_PROD,
  APP_ENV,
  BASE_URL,
  API_BASE_URL,
  STRIPE_SUCCESS_URL,
  STRIPE_CANCEL_URL,
  AUTH_REDIRECT_URL,
  AUTH_CALLBACK_URL,
};

// Debug info
console.log('App Config:', {
  environment: APP_ENV,
  baseUrl: BASE_URL,
  isDev: IS_DEV,
  isProd: IS_PROD
});

export default CONFIG;
