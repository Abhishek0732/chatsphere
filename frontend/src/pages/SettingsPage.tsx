import { SettingsPanel } from '@/features/settings/SettingsPanel';

export function SettingsPage() {
  return (
    <div className="h-full overflow-y-auto bg-white scrollbar-thin dark:bg-slate-900">
      <SettingsPanel />
    </div>
  );
}
