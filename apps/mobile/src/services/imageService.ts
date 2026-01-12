import { supabase } from '../lib/supabase';
import * as FileSystem from 'expo-file-system';
import { AnalyzeImageRequest, AnalyzeImageResponse } from '../types/analyzeImage';

const BUCKET_NAME = 'item-images';

interface UploadImageResult {
  path: string;
  publicUrl?: string;
  error?: string;
}

/**
 * Upload an image to Supabase Storage
 * @param localUri - The local file URI from the device
 * @param userId - The authenticated user's ID
 * @returns Object containing the storage path and optional public URL
 */
export async function uploadImage(
  localUri: string,
  userId: string
): Promise<UploadImageResult> {
  try {
    // Get file extension from URI
    const ext = localUri.split('.').pop()?.toLowerCase() || 'jpg';
    const timestamp = Date.now();
    const fileName = `${timestamp}.${ext}`;
    const path = `${userId}/${fileName}`;

    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to blob
    const blob = base64ToBlob(base64, `image/${ext}`);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, blob, {
        contentType: `image/${ext}`,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return { path: '', error: uploadError.message };
    }

    // Note: For private buckets, we'll use signed URLs later
    // For now, just return the path
    return { path };
  } catch (error: any) {
    console.error('Error uploading image:', error);
    return { path: '', error: error.message };
  }
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
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, expiresIn);

    if (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Error getting signed URL:', error);
    return null;
  }
}

/**
 * Call the analyzeImage Edge Function
 * @param imageUrl - The public or signed URL of the image
 * @param imagePath - The storage path
 * @returns The analysis result
 */
export async function analyzeImage(
  imageUrl: string,
  imagePath: string
): Promise<AnalyzeImageResponse | null> {
  try {
    const { data, error } = await supabase.functions.invoke<AnalyzeImageResponse>(
      'analyzeImage',
      {
        body: { imageUrl, imagePath } as AnalyzeImageRequest,
      }
    );

    if (error) {
      console.error('Error calling analyzeImage:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error analyzing image:', error);
    return null;
  }
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
