'use client';

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/supabase/env';

/** Upload straight to private storage with a one-time signed upload token from the server. */
export async function uploadSigned(bucket: string, path: string, token: string, file: Blob): Promise<boolean> {
  const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { error } = await sb.storage.from(bucket).uploadToSignedUrl(path, token, file, { contentType: file.type || 'image/jpeg' });
  return !error;
}

/** Phone photos are several MB: resize to 1600px JPEG before uploading. Falls back to the original. */
export async function shrinkPhoto(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.82));
    return blob ?? file;
  } catch {
    return file;
  }
}
