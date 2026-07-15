import { useMutation } from '@tanstack/react-query';
import { reportUser, type ReportPayload } from '@/api/reports';
import { toast } from '@/store/toastStore';

/** Report a user. Shows a confirmation toast; never throws to the UI. */
export function useReportUser() {
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload: ReportPayload }) =>
      reportUser(userId, payload),
    onSuccess: () =>
      toast({
        title: 'Report submitted',
        description: 'Thanks — our team will review it.',
        variant: 'success',
      }),
    onError: () => toast({ title: 'Could not submit report', variant: 'error' }),
  });
}
