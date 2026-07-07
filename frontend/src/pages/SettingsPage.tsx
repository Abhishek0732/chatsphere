import { SettingsPanel } from '@/features/settings/SettingsPanel';

export function SettingsPage() {
  return (
    <div className="app-bg h-full overflow-y-auto scrollbar-thin">
      <SettingsPanel />
    </div>
  );
}
