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
    const timestamp = Date.now();
    // Always use .jpg since we compress to JPEG format
    const fileName = `${timestamp}.jpg`;
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
        contentType: 'image/jpeg',
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
