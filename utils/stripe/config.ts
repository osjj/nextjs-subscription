import Stripe from 'stripe';

export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY_LIVE ?? process.env.STRIPE_SECRET_KEY ?? '',
  {
    // https://github.com/stripe/stripe-node#configuration
    // https://stripe.com/docs/api/versioning
    // @ts-ignore
    apiVersion: null,
    // Register this as an official Stripe plugin.
    // https://stripe.com/docs/building-plugins#setappinfo
    appInfo: {
      name: 'Next.js Subscription Starter',
      version: '0.0.0',
      url: 'https://github.com/vercel/nextjs-subscription-payments'
    }
  }
);

const PRICE_ID_TO_TIER = {
  'price_1Qc7j6IKDyoXLJh0ZzJVH2nI': 'premium',
  // 添加你的实际价格 ID
} as const;

export function getPriceIdTier(priceId: string): 'free' | 'basic' | 'premium' {
  return PRICE_ID_TO_TIER[priceId as keyof typeof PRICE_ID_TO_TIER] || 'free';
}
