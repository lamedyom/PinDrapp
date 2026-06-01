import { useAuthStore } from '../../stores/authStore';
import { BusinessProfileScreen } from './BusinessProfileScreen';
import { ConsumerProfileScreen } from './ConsumerProfileScreen';
import { GuestProfileScreen } from './GuestProfileScreen';

/**
 * Profile entry point. Renders the right experience for who's viewing:
 *  - guest (signed out, or business user with no business row yet) → sign-up prompt
 *  - consumer (user_type=consumer) → saved places / following / deal history
 *  - business (user_type=business with a business row) → BusinessProfileScreen
 *    (it derives the businessId from authStore.business when no route param exists)
 */
export function ProfileScreen() {
  const profile = useAuthStore((s) => s.profile);
  const business = useAuthStore((s) => s.business);

  if (!profile) return <GuestProfileScreen />;
  if (profile.userType === 'consumer') return <ConsumerProfileScreen />;
  // Business or unknown-type-with-business: render the unified business profile.
  return business ? <BusinessProfileScreen /> : <GuestProfileScreen />;
}
