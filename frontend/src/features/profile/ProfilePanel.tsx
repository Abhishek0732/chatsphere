import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Camera, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Spinner, FullPageSpinner } from '@/components/ui/Spinner';
import { useMe, useUpdateProfile } from '@/hooks/useProfile';
import { uploadMedia, uploadSizeError } from '@/api/media';
import { toast } from '@/store/toastStore';
import { useImageViewer } from '@/store/imageViewerStore';

const schema = z.object({
  displayName: z.string().min(2, 'Enter your name'),
  about: z.string().max(200, 'Keep it under 200 characters').optional(),
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
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: '', about: '' },
  });

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
    <div className="mx-auto w-full max-w-lg p-6">
      <h1 className="mb-6 text-xl font-semibold">Profile</h1>

      <div className="mb-6 flex flex-col items-center gap-3">
        <div className="relative">
          <Avatar
            name={me.displayName}
            src={avatarUrl}
            size="xl"
            onClick={() => openViewer(me.displayName, avatarUrl, { circle: true })}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white shadow-md hover:bg-brand-700"
            aria-label="Change avatar"
          >
            {uploading ? <Spinner className="h-4 w-4 text-white" /> : <Camera className="h-4 w-4" />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onAvatarPicked(e.target.files?.[0])}
          />
        </div>
        <p className="text-sm text-slate-400">@{me.username}</p>
        {avatarUrl && (
          <button
            type="button"
            onClick={onRemoveAvatar}
            disabled={uploading || updateProfile.isPending}
            className="flex items-center gap-1.5 text-xs font-medium text-red-500 transition hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove photo
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Display name</label>
          <Input error={errors.displayName?.message} {...register('displayName')} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">About</label>
          <Textarea rows={3} error={errors.about?.message} {...register('about')} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <Input value={me.email} disabled readOnly />
        </div>

        <Button type="submit" loading={updateProfile.isPending} disabled={!isDirty}>
          Save changes
        </Button>
      </form>
    </div>
  );
}
