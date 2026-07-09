import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AtSign, Camera, Check, Lock, Mail, Pencil, Trash2, UserRound } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner, FullPageSpinner } from '@/components/ui/Spinner';
import { useMe, useUpdateProfile } from '@/hooks/useProfile';
import { uploadMedia, uploadSizeError } from '@/api/media';
import { toast } from '@/store/toastStore';
import { useImageViewer } from '@/store/imageViewerStore';
import { cn } from '@/utils/cn';

const ABOUT_MAX = 200;

const schema = z.object({
  displayName: z.string().min(2, 'Enter your name'),
  about: z.string().max(ABOUT_MAX, `Keep it under ${ABOUT_MAX} characters`).optional(),
});
type FormValues = z.infer<typeof schema>;

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/60 transition-all focus:border-primary/60 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-primary/50';

export function ProfilePanel() {
  const { data: me, isLoading } = useMe();
  const updateProfile = useUpdateProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const openViewer = useImageViewer((s) => s.open);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: '', about: '' },
  });

  const aboutValue = watch('about') ?? '';
  const nameValue = watch('displayName') ?? '';

  useEffect(() => {
    if (me) {
      reset({ displayName: me.displayName, about: me.about ?? '' });
      setAvatarUrl(me.avatarUrl);
    }
  }, [me, reset]);

  const onAvatarPicked = async (file: File | undefined) => {
    if (!file) return;
    const sizeError = uploadSizeError(file);
    if (sizeError) {
      toast({ title: sizeError, variant: 'error' });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setUploading(true);
    try {
      const result = await uploadMedia(file);
      setAvatarUrl(result.url);
      updateProfile.mutate({ displayName: me?.displayName ?? '', about: me?.about, avatarUrl: result.url });
    } catch {
      toast({ title: 'Avatar upload failed', variant: 'error' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onRemoveAvatar = () => {
    setAvatarUrl(undefined);
    updateProfile.mutate({ displayName: me?.displayName ?? '', about: me?.about, avatarUrl: '' });
  };

  const onSubmit = (values: FormValues) =>
    updateProfile.mutate({ displayName: values.displayName, about: values.about, avatarUrl });

  if (isLoading || !me) return <FullPageSpinner />;

  return (
    <div className="min-h-full bg-surface pb-24 text-on-surface">
      <header className="glass-panel sticky top-0 z-20 flex h-16 items-center border-x-0 border-t-0 px-5">
        <h1 className="text-xl font-bold text-primary">Profile</h1>
      </header>

      <div className="mx-auto max-w-2xl space-y-6 px-5 pt-6">
        {/* Identity hero */}
        <section className="glass-card overflow-hidden rounded-xl">
          <div className="h-24 bg-gradient-to-br from-primary-container/50 via-secondary-container/30 to-transparent" />
          <div className="px-6 pb-6">
            <div className="-mt-14 flex flex-col items-center text-center">
              <div className="relative">
                <div className="rounded-full bg-surface p-1 shadow-xl">
                  <Avatar
                    name={me.displayName}
                    src={avatarUrl}
                    size="xl"
                    className="h-24 w-24 border-2 border-primary/30 text-3xl"
                    onClick={() => openViewer(me.displayName, avatarUrl, { circle: true })}
                  />
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="message-gradient-sent absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full text-on-primary shadow-md ring-2 ring-surface transition active:scale-90 disabled:opacity-60"
                  aria-label="Change photo"
                >
                  {uploading ? <Spinner className="h-4 w-4 text-on-primary" /> : <Camera className="h-4 w-4" />}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onAvatarPicked(e.target.files?.[0])}
                />
              </div>

              <h2 className="mt-3 text-2xl font-bold tracking-tight text-on-surface">
                {nameValue || me.displayName}
              </h2>
              <p className="mt-0.5 flex items-center gap-1 text-sm text-on-surface-variant">
                <AtSign className="h-3.5 w-3.5" />
                {me.username}
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
                <span className="h-2 w-2 rounded-full bg-green-500" /> Active now
              </span>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={onRemoveAvatar}
                  disabled={uploading || updateProfile.isPending}
                  className="mt-3 flex items-center gap-1.5 text-xs font-medium text-error transition hover:opacity-80 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove photo
                </button>
              )}
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Public profile */}
          <section className="glass-card space-y-5 rounded-xl p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                <UserRound className="h-4 w-4" />
              </span>
              <h3 className="text-base font-semibold text-on-surface">Public profile</h3>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-on-surface-variant">Display name</label>
              <input placeholder="Your name" className={inputClass} {...register('displayName')} />
              {errors.displayName?.message && (
                <p className="mt-1 text-xs text-error">{errors.displayName.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-on-surface-variant">
                <span className="flex items-center gap-1.5">
                  <Pencil className="h-4 w-4 text-primary" /> About
                </span>
                <span className={aboutValue.length > ABOUT_MAX ? 'text-xs text-error' : 'text-xs text-on-surface-variant'}>
                  {aboutValue.length}/{ABOUT_MAX}
                </span>
              </label>
              <textarea
                rows={3}
                placeholder="Tell people a little about yourself"
                className={cn(inputClass, 'resize-none')}
                {...register('about')}
              />
              {errors.about?.message && <p className="mt-1 text-xs text-error">{errors.about.message}</p>}
            </div>
          </section>

          {/* Account */}
          <section className="glass-card space-y-3 rounded-xl p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                <Mail className="h-4 w-4" />
              </span>
              <h3 className="text-base font-semibold text-on-surface">Account</h3>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-on-surface-variant">Email</label>
              <div className="relative">
                <input value={me.email} disabled readOnly className={cn(inputClass, 'pr-10 opacity-70')} />
                <Lock className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
              </div>
              <p className="mt-1 text-xs text-on-surface-variant">Your email can’t be changed.</p>
            </div>
          </section>

          <button
            type="submit"
            disabled={!isDirty || updateProfile.isPending}
            className="glow-button flex items-center gap-2 rounded-xl bg-primary-container px-6 py-3 text-base font-semibold text-on-primary-container transition-all active:scale-95 disabled:opacity-50"
          >
            <Check className="h-4 w-4" /> {updateProfile.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
