/** Pull the backend's ApiException message out of an Axios error, else a fallback. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return message && message.trim() ? message : fallback;
}
