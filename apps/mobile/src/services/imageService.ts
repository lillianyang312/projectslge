import { supabase } from '../lib/supabase';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { AnalyzeImageRequest, AnalyzeImageResponse } from '../types/analyzeImage';
import * as ImageManipulator from 'expo-image-manipulator';

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
    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, byteArray, {
        contentType: `image/${ext}`,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return { path: '', error: uploadError.message };
    }

    console.log('Image uploaded successfully to:', path);
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
    const maxAttempts = 10;
    const delayMs = 10000; // 10 seconds between attempts

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`Attempt ${attempt}/${maxAttempts}: Creating signed URL for path: ${path}`);

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(path, expiresIn);

      if (!error) {
        console.log('Successfully created signed URL');
        return data.signedUrl;
      }

      if (attempt < maxAttempts) {
        console.log(`Attempt ${attempt} failed: ${error.message}. Waiting 10 seconds before retry...`);
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
