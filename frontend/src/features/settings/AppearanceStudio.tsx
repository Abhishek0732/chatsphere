import { useRef, type ReactNode } from 'react';
import {
  Check,
  Monitor,
  Moon,
  Palette,
  Paintbrush,
  Pipette,
  RotateCcw,
  Sun,
  Type,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  useThemeStore,
  ACCENTS,
  WALLPAPERS,
  FONTS,
  TEXT_SIZES,
  RADII,
  BACKGROUNDS,
  type Theme,
} from '@/store/themeStore';

function Card({
  icon,
  title,
  subtitle,
  action,
  children,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-elevated dark:border-white/10 dark:bg-[#111a2b]">
      <div className="mb-4 flex items-center gap-2.5">
        {icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-sm">
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
}) {
  return (
    <div className="flex gap-1.5 rounded-field bg-slate-100 p-1 dark:bg-white/5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-[calc(var(--radius-field)_-_4px)] px-2 py-1.5 text-sm font-medium transition',
            value === o.value
              ? 'bg-white text-slate-900 shadow-sm dark:bg-white/10 dark:text-white'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function AppearanceStudio() {
  const s = useThemeStore();
  const accentPickerRef = useRef<HTMLInputElement>(null);
  const wallPickerRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-5">
      {/* Live preview */}
      <div className="app-bg overflow-hidden rounded-2xl border border-white/50 p-4 shadow-elevated dark:border-white/10">
        <div className="rounded-panel border border-white/60 bg-white/70 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05]">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white">
              CS
            </span>
            <div className="text-sm font-semibold text-brand-gradient">Preview</div>
          </div>
          <div className="space-y-2">
            <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-slate-100 px-3 py-2 text-sm text-slate-800 dark:bg-white/10 dark:text-slate-100">
              How’s the new look? 👀
            </div>
            <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-brand-gradient px-3 py-2 text-sm text-white shadow-sm">
              Crafted, fast and totally mine. 🔥
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 rounded-field border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 dark:border-white/10 dark:bg-white/5">
              Message…
            </div>
            <button className="rounded-field bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-sm">
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Theme */}
      <Card icon={<Sun className="h-4 w-4" />} title="Theme">
        <Segmented<Theme>
          value={s.theme}
          onChange={s.setTheme}
          options={[
            { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
            { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
            { value: 'system', label: 'System', icon: <Monitor className="h-4 w-4" /> },
          ]}
        />
      </Card>

      {/* Accent */}
      <Card icon={<Palette className="h-4 w-4" />} title="Accent color" subtitle="Used across the whole app">
        <div className="flex flex-wrap items-center gap-3">
          {ACCENTS.map((a) => {
            const active = !s.customAccent && s.accent === a.key;
            return (
              <button
                key={a.key}
                onClick={() => s.setAccent(a.key)}
                title={a.label}
                aria-label={a.label}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-offset-2 transition ring-offset-white hover:scale-110 dark:ring-offset-slate-900',
                  active ? 'ring-slate-900 dark:ring-white' : 'ring-transparent',
                )}
                style={{ backgroundColor: a.swatch }}
              >
                {active && <Check className="h-4 w-4 text-white" />}
              </button>
            );
          })}

          {/* Custom color */}
          <button
            onClick={() => accentPickerRef.current?.click()}
            title="Custom color"
            className={cn(
              'relative flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-offset-2 transition ring-offset-white hover:scale-110 dark:ring-offset-slate-900',
              s.customAccent ? 'ring-slate-900 dark:ring-white' : 'ring-transparent',
            )}
            style={{
              background: s.customAccent
                ? s.customAccent
                : 'linear-gradient(135deg, #64748b, #334155)',
            }}
          >
            <Pipette className="h-4 w-4 text-white drop-shadow" />
            <input
              ref={accentPickerRef}
              type="color"
              value={s.customAccent ?? '#7c3aed'}
              onChange={(e) => s.setCustomAccent(e.target.value)}
              className="absolute inset-0 h-0 w-0 opacity-0"
              aria-label="Pick a custom accent color"
            />
          </button>
        </div>
      </Card>

      {/* Font */}
      <Card icon={<Type className="h-4 w-4" />} title="Font">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {FONTS.map((f) => (
            <button
              key={f.key}
              onClick={() => s.setFont(f.key)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl border p-3 transition',
                s.font === f.key
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5',
              )}
            >
              <span
                className="text-xl font-semibold text-slate-800 dark:text-slate-100"
                style={{ fontFamily: f.stack }}
              >
                Ag
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{f.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Text size + Roundness */}
      <Card icon={<Type className="h-4 w-4" />} title="Text size">
        <Segmented
          value={s.textSize}
          onChange={s.setTextSize}
          options={TEXT_SIZES.map((t) => ({ value: t.key, label: t.label }))}
        />
      </Card>

      <Card icon={<Paintbrush className="h-4 w-4" />} title="Roundness">
        <Segmented
          value={s.radius}
          onChange={s.setRadius}
          options={RADII.map((r) => ({ value: r.key, label: r.label }))}
        />
      </Card>

      {/* Background */}
      <Card icon={<Palette className="h-4 w-4" />} title="Background">
        <div className="grid grid-cols-4 gap-2.5">
          {BACKGROUNDS.map((b) => (
            <button
              key={b.key}
              onClick={() => s.setBackground(b.key)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl border p-2 text-[11px] transition',
                s.background === b.key
                  ? 'border-brand-500 text-brand-700 dark:text-brand-300'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5',
              )}
            >
              <span
                className="h-10 w-full rounded-lg"
                style={{
                  backgroundColor: 'rgb(15 23 42)',
                  backgroundImage:
                    b.key === 'aurora'
                      ? 'radial-gradient(60% 80% at 100% 0%, rgb(var(--brand-500)/0.7), transparent 60%), radial-gradient(60% 80% at 0% 100%, rgb(var(--brand-700)/0.7), transparent 60%)'
                      : b.key === 'vivid'
                        ? 'radial-gradient(70% 90% at 100% 0%, rgb(var(--brand-500)/0.95), transparent 60%), radial-gradient(70% 90% at 0% 100%, rgb(var(--brand-600)/0.9), transparent 60%)'
                        : b.key === 'mesh'
                          ? 'radial-gradient(50% 60% at 0% 0%, rgb(var(--brand-400)/0.9), transparent 60%), radial-gradient(50% 60% at 100% 100%, rgb(var(--brand-700)/0.85), transparent 60%)'
                          : 'radial-gradient(80% 100% at 100% 0%, rgb(var(--brand-500)/0.3), transparent 65%)',
                }}
              />
              {b.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Chat wallpaper */}
      <Card icon={<Paintbrush className="h-4 w-4" />} title="Chat wallpaper">
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
          {WALLPAPERS.map((w) => {
            const active = !s.customWallpaper && s.wallpaper === w.key;
            return (
              <button
                key={w.key}
                onClick={() => s.setWallpaper(w.key)}
                title={w.label}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border p-1.5 text-[11px] transition',
                  active
                    ? 'border-brand-500 text-brand-700 dark:text-brand-300'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5',
                )}
              >
                <span
                  className="h-8 w-full rounded-lg"
                  style={{
                    backgroundColor: s.theme === 'dark' ? w.dark : w.light,
                    backgroundImage:
                      w.key === 'plain'
                        ? 'none'
                        : 'radial-gradient(rgb(0 0 0 / 0.08) 1px, transparent 1px)',
                    backgroundSize: '8px 8px',
                  }}
                />
                {w.label}
              </button>
            );
          })}

          {/* Custom wallpaper color */}
          <button
            onClick={() => wallPickerRef.current?.click()}
            title="Custom color"
            className={cn(
              'relative flex flex-col items-center gap-1 rounded-xl border p-1.5 text-[11px] transition',
              s.customWallpaper
                ? 'border-brand-500 text-brand-700 dark:text-brand-300'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5',
            )}
          >
            <span
              className="flex h-8 w-full items-center justify-center rounded-lg"
              style={{
                background: s.customWallpaper
                  ? s.customWallpaper
                  : 'linear-gradient(135deg, #64748b, #334155)',
              }}
            >
              <Pipette className="h-3.5 w-3.5 text-white drop-shadow" />
            </span>
            Custom
            <input
              ref={wallPickerRef}
              type="color"
              value={s.customWallpaper ?? '#e8f0fb'}
              onChange={(e) => s.setCustomWallpaper(e.target.value)}
              className="absolute inset-0 h-0 w-0 opacity-0"
              aria-label="Pick a custom wallpaper color"
            />
          </button>
        </div>
      </Card>

      <button
        onClick={s.resetAppearance}
        className="flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <RotateCcw className="h-4 w-4" /> Reset appearance to defaults
      </button>
    </div>
  );
}
