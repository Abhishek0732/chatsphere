import { ProfilePanel } from '@/features/profile/ProfilePanel';

export function ProfilePage() {
  return (
    <div className="h-full overflow-y-auto bg-white scrollbar-thin dark:bg-slate-900">
      <ProfilePanel />
    </div>
  );
}
