import { useEffect, useRef, useState } from 'react';

/**
 * Lightweight, dependency-free emoji picker (WhatsApp-style). A curated set of
 * common emojis grouped into tabs — only the active category renders, so it
 * stays cheap. No npm dependency / no bundle bloat.
 */

interface Category {
  id: string;
  icon: string;
  label: string;
  emojis: string[];
}

const CATEGORIES: Category[] = [
  {
    id: 'smileys',
    icon: '😀',
    label: 'Smileys',
    emojis: '😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥳 🤩 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤠'.split(' '),
  },
  {
    id: 'gestures',
    icon: '👍',
    label: 'Gestures',
    emojis: '👍 👎 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🙌 👐 🤲 🤜 🤛 👏 🫶 🫰 🤙'.split(' '),
  },
  {
    id: 'hearts',
    icon: '❤️',
    label: 'Hearts',
    emojis: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ❤️‍🔥 💯 💢 💥 💫 💦 💨 🔥 ✨ ⭐ 🌟 💤 💬 💭'.split(' '),
  },
  {
    id: 'animals',
    icon: '🐶',
    label: 'Animals',
    emojis: '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🐺 🐗 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐢 🐍 🐙 🦑 🦐 🦀 🐟 🐠 🐡 🐬 🐳 🐋 🦈 🐊 🐘 🦏 🐪 🐫 🦒 🐐 🐓 🕊️ 🐇 🐿️ 🌸 🌷 🌹 🌻 🌼 🌵 🌲 🌴 🍀 🍁 🍄'.split(' '),
  },
  {
    id: 'food',
    icon: '🍔',
    label: 'Food',
    emojis: '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🥦 🌽 🥕 🥔 🍞 🧀 🥚 🥓 🍗 🍖 🌭 🍔 🍟 🍕 🥪 🌮 🌯 🥙 🍝 🍜 🍲 🍛 🍣 🍱 🍤 🍙 🍚 🍥 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🍯 ☕ 🍵 🥤 🍺 🍻 🥂 🍷 🍸 🍹 🍾'.split(' '),
  },
  {
    id: 'activity',
    icon: '⚽',
    label: 'Activity',
    emojis: '⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🏓 🏸 🏒 🏑 🏏 ⛳ 🏹 🎣 🥊 🥋 🎽 🛹 ⛸️ 🎿 🏂 🏋️ 🤸 🤾 🏌️ 🏇 🧘 🏄 🏊 🚣 🧗 🚵 🚴 🏆 🥇 🥈 🥉 🏅 🎖️ 🎪 🎭 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🎻 🎲 🎯 🎳 🎮 🎰 🧩'.split(' '),
  },
  {
    id: 'travel',
    icon: '🚗',
    label: 'Travel',
    emojis: '🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🚚 🚛 🚜 🛴 🚲 🛵 🏍️ ✈️ 🚀 🚁 ⛵ 🚤 🚢 ⚓ ⛽ 🚦 🗺️ 🗿 🗽 🎡 🎢 🎠 🏰 🏯 🏟️ 🎇 🎆 🌅 🌄 🌇 🌆 🌃 🌉 🌌 🏔️ ⛰️ 🌋 🏕️ 🏖️ 🏝️ ☀️ 🌤️ ⛅ ☁️ 🌧️ ⛈️ 🌈 ❄️ ⛄ 🌙 ⭐ 🌟'.split(' '),
  },
  {
    id: 'symbols',
    icon: '✅',
    label: 'Symbols',
    emojis: '✅ ❌ ⭕ 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 ✔️ ➕ ➖ ✖️ ♾️ ❗ ❓ ❕ ❔ ‼️ ⁉️ 💯 🔥 ⭐ 🌟 ✨ ⚡ 🎉 🎊 🎈 🎁 🎀 🔔 💡 💰 💎 🏆 🚩 🏁 ✔️ ☑️ 🆗 🆕 🆒 🔝 ♻️ ✅ ⏰ ⏳ ⌛'.split(' '),
  },
];

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: Props) {
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Defer so the opening click doesn't immediately close it.
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="flex h-72 w-[19rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface-container/95 text-on-surface shadow-2xl backdrop-blur-xl"
      role="dialog"
      aria-label="Emoji picker"
    >
      <div className="grid flex-1 grid-cols-8 content-start gap-0.5 overflow-y-auto scrollbar-thin p-2">
        {CATEGORIES[active].emojis.map((e, i) => (
          <button
            key={`${e}-${i}`}
            type="button"
            onClick={() => onSelect(e)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-xl transition hover:bg-white/5"
            aria-label={e}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="flex shrink-0 items-center justify-between border-t border-white/10 px-1">
        {CATEGORIES.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActive(i)}
            className={
              'flex h-9 flex-1 items-center justify-center rounded-lg text-lg transition ' +
              (i === active
                ? 'bg-brand-500/10 opacity-100'
                : 'opacity-60 hover:opacity-100 hover:bg-white/5')
            }
            aria-label={c.label}
          >
            {c.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
