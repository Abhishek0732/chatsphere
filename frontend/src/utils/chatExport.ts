import type { ExportMessage } from '@/types';

const pad = (n: number) => String(n).padStart(2, '0');

/** One transcript line, messenger-style: "[dd/mm/yyyy, hh:mm] Name: message". */
function formatLine(m: ExportMessage): string {
  const d = new Date(m.createdAt);
  const ts = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  let body: string;
  if (m.deleted) body = 'This message was deleted';
  else if (m.type === 'IMAGE') body = m.content ? `<image omitted> ${m.content}` : '<image omitted>';
  else if (m.type === 'FILE') body = '<file omitted>';
  else if (m.type === 'VOICE' || m.type === 'AUDIO') body = '<voice message omitted>';
  else body = m.content ?? '';
  return `[${ts}] ${m.senderName}: ${body}`;
}

/** Build the full .txt transcript for a chat export (media is omitted, text only). */
export function formatChatExport(chatName: string, msgs: ExportMessage[]): string {
  const header =
    `Chat: ${chatName}\n` +
    `Exported from ChatSphere — ${new Date().toLocaleString()}\n` +
    `${msgs.length} message${msgs.length === 1 ? '' : 's'}\n\n`;
  return header + msgs.map(formatLine).join('\n') + '\n';
}
