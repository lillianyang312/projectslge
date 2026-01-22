/**
 * PDF Service - Handles senior sale PDF uploads and extraction
 */

import { supabase } from '../lib/supabase';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { useAuthStore } from '../state/authStore';
import { PDFExtractionRequest, PDFExtractionResponse, ExtractedItemOutput } from '../types/pdfExtraction';

const PDF_BUCKET_NAME = 'item-pdfs';

interface UploadPDFResult {
  path: string;
  error?: string;
}

/**
 * Upload a PDF file to Supabase Storage
 * @param localUri - The local file URI from the device
 * @param userId - The authenticated user's ID
 * @returns Object containing the storage path
 */
export async function uploadPDF(
  localUri: string,
  userId: string
): Promise<UploadPDFResult> {
  try {
    const timestamp = Date.now();
    const fileName = `${timestamp}.pdf`;
    const path = `${userId}/${fileName}`;

    console.log('Starting PDF upload...');

    // Read file as base64
    const base64Data = await readAsStringAsync(localUri, {
      encoding: 'base64',
    });

    console.log('PDF file size:', base64Data.length, 'bytes (base64)');

    // Convert base64 to binary for upload
    const byteCharacters = atob ? atob(base64Data) : Buffer.from(base64Data, 'base64').toString('binary');
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);

    console.log('Uploading PDF of size:', byteArray.byteLength, 'bytes');

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(PDF_BUCKET_NAME)
      .upload(path, byteArray, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('PDF upload error:', uploadError);
      return { path: '', error: uploadError.message };
    }

    console.log('PDF uploaded successfully to:', path);
    return { path };
  } catch (error: any) {
    console.error('Error uploading PDF:', error);
    return { path: '', error: error.message };
  }
}

/**
 * Extract items from a PDF using the extractPDF edge function
 * @param pdfPath - The storage path of the PDF
 * @param userId - The user's ID
 * @returns Extraction response with extracted items
 */
export async function extractItemsFromPDF(
  pdfPath: string,
  userId: string
): Promise<PDFExtractionResponse> {
  try {
    console.log('Calling extractPDF function for:', pdfPath);

    const request: PDFExtractionRequest = {
      pdfPath,
      userId,
      options: {
        extractMetadata: true,
        analyzeImages: true,
      },
    };

    const { data, error } = await supabase.functions.invoke('extractPDF', {
      body: request,
    });

    if (error) {
      console.error('Extract PDF function error:', error);
      return {
        success: false,
        items: [],
        errors: [error.message || 'Failed to extract PDF'],
      };
    }

    console.log('PDF extraction successful:', data);
    return data as PDFExtractionResponse;
  } catch (error: any) {
    console.error('Error extracting PDF items:', error);
    return {
      success: false,
      items: [],
      errors: [error.message || 'Unknown error during extraction'],
    };
  }
}

/**
 * Complete flow: upload PDF and extract items
 * @param localUri - Local PDF file path
 * @returns Extracted items ready for creation
 */
export async function uploadAndExtractPDF(
  localUri: string
): Promise<{ items: ExtractedItemOutput[]; error?: string }> {
  try {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) {
      return { items: [], error: 'User not authenticated' };
    }

    // Step 1: Upload PDF
    console.log('Step 1: Uploading PDF...');
    const uploadResult = await uploadPDF(localUri, userId);
    if (uploadResult.error) {
      return { items: [], error: uploadResult.error };
    }

    // Step 2: Extract items from PDF
    console.log('Step 2: Extracting items...');
    const extractionResult = await extractItemsFromPDF(uploadResult.path, userId);

    if (!extractionResult.success) {
      return {
        items: [],
        error: extractionResult.errors?.join('; ') || 'Extraction failed',
      };
    }

    console.log(
      `Step 3: Successfully extracted ${extractionResult.items.length} items`
    );

    return { items: extractionResult.items };
  } catch (error: any) {
    console.error('Error in upload and extract:', error);
    return { items: [], error: error.message };
  }
}
