import { CallsPanel } from '@/features/call/CallsPanel';

export function CallsPage() {
  return (
    <div className="app-bg h-full overflow-y-auto scrollbar-thin">
      <CallsPanel />
    </div>
  );
}
