import { api } from './client';

/** A catalogue track. `previewUrl` is the ~30s clip a status plays. */
export interface CatalogTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  artworkUrl: string;
  previewUrl: string;
  durationMs: number;
}

export async function getMusicCategories(): Promise<string[]> {
  const { data } = await api.get<{ categories: string[] }>('/music/categories');
  return data.categories;
}

/** Search the catalogue, or browse a category when `q` is empty. */
export async function searchMusic(params: {
  q?: string;
  category?: string;
  limit?: number;
}): Promise<CatalogTrack[]> {
  const { data } = await api.get<CatalogTrack[]>('/music/search', { params });
  return data;
}
