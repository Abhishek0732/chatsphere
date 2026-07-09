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
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-center gap-2.5">
        {icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-on-surface">{title}</h2>
          {subtitle && <p className="text-xs text-on-surface-variant">{subtitle}</p>}
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
    <div className="flex gap-1.5 rounded-xl bg-white/5 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium transition',
            value === o.value
              ? 'bg-white/10 text-on-surface shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface',
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
      <div className="overflow-hidden rounded-xl border border-white/10 bg-surface-container-low p-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="message-gradient-sent flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-on-primary">
              CS
            </span>
            <div className="text-sm font-semibold text-primary">Preview</div>
          </div>
          <div className="space-y-2">
            <div className="glass-panel max-w-[80%] rounded-2xl rounded-bl-none px-3 py-2 text-sm text-on-surface">
              How’s the new look? 👀
            </div>
            <div className="message-gradient-sent ml-auto max-w-[80%] rounded-2xl rounded-br-none px-3 py-2 text-sm text-on-primary shadow-sm">
              Crafted, fast and totally mine. 🔥
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-on-surface-variant">
              Message…
            </div>
            <button className="message-gradient-sent rounded-full px-4 py-2 text-sm font-medium text-on-primary shadow-sm">
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
                  'flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-offset-2 transition ring-offset-surface hover:scale-110',
                  active ? 'ring-primary' : 'ring-transparent',
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
              'relative flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-offset-2 transition ring-offset-surface hover:scale-110',
              s.customAccent ? 'ring-primary' : 'ring-transparent',
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
                  ? 'border-primary bg-primary/10'
                  : 'border-white/10 hover:bg-white/5',
              )}
            >
              <span
                className="text-xl font-semibold text-on-surface"
                style={{ fontFamily: f.stack }}
              >
                Ag
              </span>
              <span className="text-[11px] text-on-surface-variant">{f.label}</span>
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
                  ? 'border-primary text-primary'
                  : 'border-white/10 text-on-surface-variant hover:bg-white/5',
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
                    ? 'border-primary text-primary'
                    : 'border-white/10 text-on-surface-variant hover:bg-white/5',
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
                ? 'border-primary text-primary'
                : 'border-white/10 text-on-surface-variant hover:bg-white/5',
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
        className="flex items-center gap-2 text-sm font-medium text-on-surface-variant transition hover:text-on-surface"
      >
        <RotateCcw className="h-4 w-4" /> Reset appearance to defaults
      </button>
    </div>
  );
}
