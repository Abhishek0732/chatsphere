import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { canEncryptWith } from '@/services/e2ee';
import { useE2eeStore } from '@/store/e2eeStore';

/**
 * The messenger-style notice at the top of an encrypted thread.
 *
 * A padlock tucked next to the name was the only sign the chat was encrypted, and the
 * word "encrypted" appeared nowhere in the app — which is no use: a privacy property
 * nobody can see is a property nobody can rely on. This says it in words, in the place
 * people are already looking.
 *
 * It renders ONLY when the chat really is encrypted (both sides have keys). A notice
 * that promises encryption that is not happening would be worse than none at all.
 */
export function EncryptionNotice({ peerId }: { peerId: number | undefined }) {
  const ready = useE2eeStore((s) => s.ready);
  const [encrypted, setEncrypted] = useState(false);

  useEffect(() => {
    let live = true;
    if (peerId == null) {
      setEncrypted(false);
      return;
    }
    void canEncryptWith(peerId)
      .then((can) => live && setEncrypted(can))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [peerId, ready]);

  if (!encrypted) return null;

  return (
    <div className="flex justify-center px-4 py-3">
      <p className="flex max-w-md items-start gap-2 rounded-xl bg-primary-container/50 px-3.5 py-2.5 text-center text-xs leading-relaxed text-on-primary-container">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Messages in this chat are <b>end-to-end encrypted</b>. They are locked on your
          device and can only be read by you and {'​'}the person you are talking to —
          not by ChatSphere.
        </span>
      </p>
    </div>
  );
}
