import { SupabaseClient } from '@supabase/supabase-js';
import { cache } from 'react';
import { createClient } from '@/utils/supabase/server';
export const getUser = cache(async () => {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user;
});

export const getSubscription = cache(async () => {
  const supabase = createClient();
  const user = await getUser();

  if (!user) {
    console.error('User not found');
    return null;
  }

  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .select('id, user_id, status, metadata, price_id, quantity, cancel_at_period_end, created, current_period_start, current_period_end, ended_at, cancel_at, canceled_at, trial_start, trial_end')
    .in('status', ['trialing', 'active'])
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching subscription:', error);
    return null;
  }

  return subscription;
});

export const getProducts = cache(async () => {
  const supabase = createClient();
  const { data: products, error } = await supabase
    .from('products')
    .select('*, prices(*)')
    .eq('active', true)
    .eq('prices.active', true)
    .order('metadata->index')
    .order('unit_amount', { referencedTable: 'prices' });

  return products;
});

export const getUserDetails = cache(async () => {
  const supabase = createClient();
  const { data: userDetails } = await supabase
    .from('users')
    .select('*')
    .single();
  return userDetails;
});
