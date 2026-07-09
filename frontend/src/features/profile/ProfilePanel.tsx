import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AtSign, Camera, Check, Lock, Mail, Pencil, Trash2, UserRound } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Spinner, FullPageSpinner } from '@/components/ui/Spinner';
import { useMe, useUpdateProfile } from '@/hooks/useProfile';
import { uploadMedia, uploadSizeError } from '@/api/media';
import { toast } from '@/store/toastStore';
import { useImageViewer } from '@/store/imageViewerStore';

const ABOUT_MAX = 200;

const schema = z.object({
  displayName: z.string().min(2, 'Enter your name'),
  about: z.string().max(ABOUT_MAX, `Keep it under ${ABOUT_MAX} characters`).optional(),
});
type FormValues = z.infer<typeof schema>;

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
      updateProfile.mutate({
        displayName: me?.displayName ?? '',
        about: me?.about,
        avatarUrl: result.url,
      });
    } catch {
      toast({ title: 'Avatar upload failed', variant: 'error' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onRemoveAvatar = () => {
    setAvatarUrl(undefined);
    updateProfile.mutate({
      displayName: me?.displayName ?? '',
      about: me?.about,
      avatarUrl: '', // empty string tells the backend to clear the picture
    });
  };

  const onSubmit = (values: FormValues) => {
    updateProfile.mutate({
      displayName: values.displayName,
      about: values.about,
      avatarUrl,
    });
  };

  if (isLoading || !me) return <FullPageSpinner />;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 p-4 sm:p-6">
      <h1 className="px-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
        Profile
      </h1>

      {/* Identity hero */}
      <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-elevated dark:border-white/10 dark:bg-[#111a2b]">
        <div className="relative h-28 bg-brand-gradient sm:h-32">
          <div className="pointer-events-none absolute -left-8 -top-10 h-40 w-40 rounded-full bg-white/25 blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        </div>

        <div className="px-5 pb-6 sm:px-8">
          <div className="-mt-14 flex flex-col items-center text-center">
            <div className="relative">
              <div className="rounded-full bg-white p-1 shadow-lg dark:bg-[#111a2b]">
                {/* Your own photo — never protected against yourself. */}
                <Avatar
                  name={me.displayName}
                  src={avatarUrl}
                  size="xl"
                  className="ring-1 ring-black/5 dark:ring-white/10"
                  onClick={() => openViewer(me.displayName, avatarUrl, { circle: true })}
                />
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-white shadow-md ring-2 ring-white transition hover:brightness-110 disabled:opacity-60 dark:ring-[#111a2b]"
                aria-label="Change photo"
              >
                {uploading ? (
                  <Spinner className="h-4 w-4 text-white" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onAvatarPicked(e.target.files?.[0])}
              />
            </div>

            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {nameValue || me.displayName}
            </h2>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
              <AtSign className="h-3.5 w-3.5" />
              {me.username}
            </p>

            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-600 dark:text-brand-300">
              <span className="h-2 w-2 rounded-full bg-brand-500" /> Active now
            </span>

            {avatarUrl && (
              <button
                type="button"
                onClick={onRemoveAvatar}
                disabled={uploading || updateProfile.isPending}
                className="mt-3 flex items-center gap-1.5 text-xs font-medium text-red-500 transition hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove photo
              </button>
            )}
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Public profile */}
        <section className="space-y-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-elevated dark:border-white/10 dark:bg-[#111a2b] sm:p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-sm">
              <UserRound className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Public profile
            </h3>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Display name
            </label>
            <Input
              placeholder="Your name"
              error={errors.displayName?.message}
              {...register('displayName')}
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Pencil className="h-4 w-4 text-brand-500" /> About
              </span>
              <span
                className={
                  aboutValue.length > ABOUT_MAX
                    ? 'text-xs font-normal text-red-500'
                    : 'text-xs font-normal text-slate-400'
                }
              >
                {aboutValue.length}/{ABOUT_MAX}
              </span>
            </label>
            <Textarea
              rows={3}
              placeholder="Tell people a little about yourself"
              error={errors.about?.message}
              {...register('about')}
            />
          </div>
        </section>

        {/* Account */}
        <section className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-elevated dark:border-white/10 dark:bg-[#111a2b] sm:p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-sm">
              <Mail className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Account</h3>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Email
            </label>
            <div className="relative">
              <Input value={me.email} disabled readOnly className="pr-9" />
              <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            <p className="mt-1 text-xs text-slate-400">Your email can’t be changed.</p>
          </div>
        </section>

        <Button
          type="submit"
          loading={updateProfile.isPending}
          disabled={!isDirty}
          className="w-full sm:w-auto"
        >
          <Check className="h-4 w-4" /> Save changes
        </Button>
      </form>
    </div>
  );
}
