import { api } from './client';
import type { Contact, ContactRequest, SendRequestResult } from '@/types';

export async function getContacts(): Promise<Contact[]> {
  const { data } = await api.get<Contact[]>('/contacts');
  return data;
}

/** Scan a QR code to send that user a contact invitation (they accept manually). */
export async function requestByQr(code: string): Promise<SendRequestResult> {
  const { data } = await api.post<SendRequestResult>('/contacts/qr', { code });
  return data;
}

/** Open an invite link (/i/<code>) to send that user a contact invitation. */
export async function requestByInvite(code: string): Promise<SendRequestResult> {
  const { data } = await api.post<SendRequestResult>('/contacts/invite', { code });
  return data;
}

/** Sends a contact invitation. The user is only added once they accept. */
export async function addContact(contactUserId: number): Promise<SendRequestResult> {
  const { data } = await api.post<SendRequestResult>('/contacts', { contactUserId });
  return data;
}

export async function deleteContact(id: number): Promise<void> {
  await api.delete(`/contacts/${id}`);
}

/** Pending invitations sent to me. */
export async function getIncomingRequests(): Promise<ContactRequest[]> {
  const { data } = await api.get<ContactRequest[]>('/contacts/requests');
  return data;
}

/** Pending invitations I have sent. */
export async function getOutgoingRequests(): Promise<ContactRequest[]> {
  const { data } = await api.get<ContactRequest[]>('/contacts/requests/outgoing');
  return data;
}

export async function acceptContactRequest(id: number): Promise<void> {
  await api.post(`/contacts/requests/${id}/accept`);
}

export async function declineContactRequest(id: number): Promise<void> {
  await api.post(`/contacts/requests/${id}/decline`);
}
