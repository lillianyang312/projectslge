import { supabase } from '../lib/supabase';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { AnalyzeImageRequest, AnalyzeImageResponse } from '../types/analyzeImage';
import * as ImageManipulator from 'expo-image-manipulator';
import { useAuthStore } from '../state/authStore';
import {
  getSignedUrlCachedInternal,
  GetSignedUrlCachedOptions,
} from './signedUrlCache';

const BUCKET_NAME = 'item-images';

interface UploadImageResult {
  path: string;
  publicUrl?: string;
  error?: string;
}

/**
 * Generate a random string for unique filenames
 */
function generateRandomId(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Upload an image to Supabase Storage
 * @param localUri - The local file URI from the device
 * @param userId - The authenticated user's ID
 * @param groupId - Optional group ID for batch uploads (all images in a group share this ID)
 * @param imageIndex - Optional index within the group
 * @returns Object containing the storage path and optional public URL
 */
export async function uploadImage(
  localUri: string,
  userId: string,
  groupId?: string,
  imageIndex?: number
): Promise<UploadImageResult> {
  try {
    const timestamp = Date.now();
    const randomSuffix = generateRandomId(6);
    // Create unique filename: timestamp_randomSuffix.jpg OR groupId_index.jpg for grouped uploads
    const fileName = groupId && imageIndex !== undefined
      ? `${groupId}_${imageIndex}.jpg`
      : `${timestamp}_${randomSuffix}.jpg`;
    const path = `${userId}/${fileName}`;

    console.log('Starting image compression...');
    // Compress image before upload
    const compressedImage = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: 1920, height: 1920 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );

    console.log('Image compressed, reading file...');
    // Read compressed file as base64 (using legacy API for compatibility)
    const base64Data = await readAsStringAsync(compressedImage.uri, {
      encoding: 'base64',
    });

    console.log('Base64 data length:', base64Data.length);
    // Convert base64 to binary for upload
    const byteCharacters = atob ? atob(base64Data) : Buffer.from(base64Data, 'base64').toString('binary');
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);

    console.log('Uploading image of size:', byteArray.byteLength, 'bytes');

    // Upload to Supabase Storage with retry logic for network timeouts
    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Upload attempt ${attempt}/${maxRetries}...`);

        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(path, byteArray, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (!uploadError) {
          console.log('Image uploaded successfully to:', path);
          return { path };
        }

        lastError = uploadError;
        console.error(`Upload attempt ${attempt} failed:`, uploadError);

        // Don't retry on non-timeout errors
        if (!uploadError.message?.includes('timeout') && !uploadError.message?.includes('Network')) {
          return { path: '', error: uploadError.message };
        }

        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff: 2s, 4s)
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Retrying in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (err: any) {
        lastError = err;
        console.error(`Upload attempt ${attempt} threw error:`, err);

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Retrying in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    console.error('All upload attempts failed:', lastError);
    return { path: '', error: lastError?.message || 'Upload failed after retries' };

  } catch (error: any) {
    console.error('Error uploading image:', error);
    return { path: '', error: error.message };
  }
}

/**
 * Upload multiple images as a group with a shared group ID
 * All images contribute to the unique group identifier
 * @param localUris - Array of local file URIs
 * @param userId - The authenticated user's ID
 * @returns Object containing array of storage paths and the group ID
 */
export async function uploadImageGroup(
  localUris: string[],
  userId: string
): Promise<{ paths: string[]; groupId: string; errors: string[] }> {
  // Generate a unique group ID based on timestamp + random + image count
  const timestamp = Date.now();
  const randomPart = generateRandomId(8);
  const groupId = `${timestamp}_${randomPart}_${localUris.length}img`;

  console.log(`Uploading group of ${localUris.length} images with groupId: ${groupId}`);

  const paths: string[] = [];
  const errors: string[] = [];

  // Upload all images in parallel with group ID
  const uploadPromises = localUris.map((uri, index) =>
    uploadImage(uri, userId, groupId, index)
  );

  const results = await Promise.all(uploadPromises);

  results.forEach((result, index) => {
    if (result.error) {
      errors.push(`Image ${index + 1}: ${result.error}`);
    } else if (result.path) {
      paths.push(result.path);
    }
  });

  console.log(`Group upload complete: ${paths.length}/${localUris.length} successful`);

  return { paths, groupId, errors };
}

/**
 * Get a signed URL for a private image
 * @param path - The storage path
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns The signed URL or null if error
 */
export async function getSignedUrl(
  path: string,
  expiresIn: number = 3600
): Promise<string | null> {
  try {
    const maxAttempts = 3;
    const delayMs = 1000; // 1 second between attempts

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`Attempt ${attempt}/${maxAttempts}: Creating signed URL for path: ${path}`);

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(path, expiresIn);

      if (!error && data?.signedUrl) {
        console.log('Successfully created signed URL');
        return data.signedUrl;
      }

      if (attempt < maxAttempts) {
        console.log(`Attempt ${attempt} failed: ${error?.message || 'No signed URL returned'}. Retrying in 1 second...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        console.error(`All ${maxAttempts} attempts failed. Last error:`, error);
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting signed URL:', error);
    return null;
  }
}

/**
 * Get a cached signed URL for a private image.
 *
 * - Uses a per-user persisted cache so URLs survive app restarts.
 * - Returns cached URL immediately when fresh.
 * - When near expiry, returns cached URL and refreshes in background.
 * - When expired or missing, blocks until a new URL is fetched.
 */
export async function getSignedUrlCached(
  path: string,
  options?: GetSignedUrlCachedOptions
): Promise<string | null> {
  const ttlSeconds = options?.ttlSeconds ?? 3600;
  const userId = useAuthStore.getState().user?.id || 'anonymous';
  const cacheKey = `${BUCKET_NAME}:${path}`;

  return getSignedUrlCachedInternal({
    key: cacheKey,
    userScope: userId,
    ttlSeconds,
    fetcher: () => getSignedUrl(path, ttlSeconds),
  });
}

/**
 * Prefetch signed URLs for a list of image paths.
 * Returns a map from path to signed URL (for paths that resolved successfully).
 */
export async function prefetchSignedUrls(
  paths: string[],
  options?: GetSignedUrlCachedOptions
): Promise<Record<string, string>> {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  const results: Record<string, string> = {};

  await Promise.all(
    uniquePaths.map(async (p) => {
      const url = await getSignedUrlCached(p, options);
      if (url) {
        results[p] = url;
      }
    })
  );

  return results;
}

/**
 * Call the analyzeImage Edge Function with multiple images
 * @param imageUrls - Array of public or signed URLs of the images
 * @param imagePaths - Array of storage paths
 * @returns The analysis result
 */
export async function analyzeImages(
  imageUrls: string[],
  imagePaths: string[]
): Promise<AnalyzeImageResponse | null> {
  try {
    console.log(`Analyzing ${imageUrls.length} image(s) with Claude Vision...`);
    const { data, error } = await supabase.functions.invoke<AnalyzeImageResponse>(
      'analyzeImage',
      {
        body: { imageUrls, imagePaths } as AnalyzeImageRequest,
      }
    );

    if (error) {
      console.error('Error calling analyzeImage:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error analyzing images:', error);
    return null;
  }
}

/**
 * Call the analyzeImage Edge Function (legacy single image support)
 * @param imageUrl - The public or signed URL of the image
 * @param imagePath - The storage path
 * @returns The analysis result
 */
export async function analyzeImage(
  imageUrl: string,
  imagePath: string
): Promise<AnalyzeImageResponse | null> {
  return analyzeImages([imageUrl], [imagePath]);
}

/**
 * Helper function to convert base64 to Blob
 */
function base64ToBlob(base64: string, contentType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}
