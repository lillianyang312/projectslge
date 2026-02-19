import { createClient } from '@/lib/supabase/client';

const BUCKET_NAME = 'item-images';

/* ── AI Analysis Types (mirrors analyzeImage edge function response) ── */

export interface CategoryDetails {
  clothing?: { size?: string; clothingType?: string; brand?: string; color?: string; material?: string; gender?: string; style?: string };
  electronics?: { brand?: string; model?: string; storage?: string; color?: string; screenSize?: string; specs?: string };
  furniture?: { material?: string; color?: string; dimensions?: string; style?: string };
  books?: { author?: string; isbn?: string; edition?: string; publisher?: string; subject?: string };
}

export interface IdentifiedItem {
  title: string;
  category: string;
  description?: string;
  condition?: string;
  tags?: string[];
  categoryDetails?: CategoryDetails;
}

export interface ClarificationOption {
  id: string;
  label: string;
  thumbnail?: string;
  descriptor: string;
}

export type AnalyzeImageResponse =
  | { type: 'identified'; item: IdentifiedItem; confidence: number }
  | { type: 'needs_clarification'; question: string; options: ClarificationOption[]; confidence: number };

function generateRandomId(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/**
 * Compress an image file using canvas before upload.
 * Resizes to maxDimension and converts to JPEG at given quality.
 */
async function compressImage(
  file: File,
  maxDimension: number = 1200,
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Failed to get canvas context')); return; }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to compress image'));
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Upload a single image file to Supabase Storage.
 */
export async function uploadImage(
  file: File,
  userId: string
): Promise<{ path: string; error?: string }> {
  try {
    const supabase = createClient();
    const compressed = await compressImage(file);
    const timestamp = Date.now();
    const randomSuffix = generateRandomId(6);
    const fileName = `${timestamp}_${randomSuffix}.jpg`;
    const path = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, compressed, { contentType: 'image/jpeg', upsert: true });

    if (uploadError) return { path: '', error: uploadError.message };
    return { path };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return { path: '', error: message };
  }
}

/**
 * Upload multiple images in parallel.
 */
export async function uploadImages(
  files: File[],
  userId: string
): Promise<{ paths: string[]; errors: string[] }> {
  const paths: string[] = [];
  const errors: string[] = [];

  const results = await Promise.all(files.map((f) => uploadImage(f, userId)));
  results.forEach((r, i) => {
    if (r.error) errors.push(`Image ${i + 1}: ${r.error}`);
    else if (r.path) paths.push(r.path);
  });

  return { paths, errors };
}

/**
 * Get the public URL for an image stored in item-images bucket.
 */
export function getPublicUrl(path: string): string {
  const supabase = createClient();
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Get a signed URL for a private image.
 */
export async function getSignedUrl(path: string, expiresIn: number = 3600): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, expiresIn);

    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * Upload images and call the analyzeImage edge function for AI identification.
 * Returns the analysis result and the uploaded paths.
 */
export async function analyzeImages(
  files: File[],
  userId: string
): Promise<{ response: AnalyzeImageResponse | null; paths: string[]; error?: string }> {
  try {
    // Step 1: Upload images to storage
    const { paths, errors } = await uploadImages(files, userId);
    if (errors.length > 0 || paths.length === 0) {
      return { response: null, paths, error: errors.join('; ') || 'No images uploaded' };
    }

    // Step 2: Generate signed URLs for the edge function
    const signedUrls: string[] = [];
    for (const path of paths) {
      const url = await getSignedUrl(path, 600); // 10 minute expiry
      if (url) signedUrls.push(url);
    }

    if (signedUrls.length === 0) {
      return { response: null, paths, error: 'Failed to generate signed URLs' };
    }

    // Step 3: Call the analyzeImage edge function
    const supabase = createClient();
    const { data, error: fnError } = await supabase.functions.invoke('analyzeImage', {
      body: { imageUrls: signedUrls, imagePaths: paths },
    });

    if (fnError) {
      return { response: null, paths, error: fnError.message };
    }

    return { response: data as AnalyzeImageResponse, paths };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Analysis failed';
    return { response: null, paths: [], error: message };
  }
}
