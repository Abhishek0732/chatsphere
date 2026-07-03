/** Generate a client-side temporary id for optimistic messages. */
export function makeTempId(): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `tmp_${Date.now()}_${rnd}`;
}
