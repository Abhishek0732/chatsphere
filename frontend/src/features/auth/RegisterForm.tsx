import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRegister } from '@/hooks/useAuth';
import { registerSchema, type RegisterFormValues } from './schemas';

export function RegisterForm() {
  const registerMutation = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      displayName: '',
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = (values: RegisterFormValues) => {
    registerMutation.mutate({
      displayName: values.displayName,
      username: values.username,
      email: values.email,
      password: values.password,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Display name</label>
        <Input placeholder="Ada Lovelace" error={errors.displayName?.message} {...register('displayName')} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Username</label>
        <Input placeholder="ada" error={errors.username?.message} {...register('username')} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Email</label>
        <Input
          type="email"
          autoComplete="email"
          placeholder="ada@example.com"
          error={errors.email?.message}
          {...register('email')}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Password</label>
        <Input
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Confirm password</label>
        <Input
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
      </div>

      <Button type="submit" className="w-full" loading={registerMutation.isPending}>
        Create account
      </Button>

      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
