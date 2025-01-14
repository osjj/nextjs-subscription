import Pricing from '@/components/ui/Pricing/Pricing';
import { createClient } from '@/utils/supabase/client';
import {
  getProducts,
  getSubscription,
  getUser
} from '@/utils/supabase/queries';

export default async function PricingPage() {
  //const supabase = createClient();
  const [user, products, subscription] = await Promise.all([
    getUser(),
    getProducts(),
    getSubscription()
  ]);
  console.log(user,222)
  console.log(products,333333)
  console.log(subscription,55555555555555)
  return (
    <Pricing
      user={user}
      products={products ?? []}
      subscription={subscription}
    />
  );
}
