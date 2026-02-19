'use client';

import { useState, useRef, useCallback, useEffect, type ChangeEvent, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import PageContainer from '@/components/layout/PageContainer';
import { Button, Badge, Spinner } from '@/components/ui';
import { uploadImages, analyzeImages, type IdentifiedItem, type CategoryDetails } from '@/services/imageService';
import { createItem } from '@/services/itemsService';
import { estimatePrice, type EstimatePriceResponse } from '@/services/pricingService';
import { getAllCategories, getCategoryFields } from '@/config/categoryFields';
import { useAuthStore } from '@/stores/authStore';

/* ── Types ────────────────────────────────────────────────────────── */

type SingleStep = 'photos' | 'details' | 'price' | 'submitting';
type BulkStep = 'photos' | 'grouping' | 'verify' | 'bulkPrice' | 'summary' | 'submitting';

interface BulkItem {
  id: string;
  files: File[];
  previews: string[];
  uploadedPaths: string[];
  title: string;
  category: string;
  condition: string;
  notes: string;
  categoryFields: Record<string, string>;
  priceEstimate: EstimatePriceResponse | null;
  minPrice: string;
  retailPrice: string;
  isVerified: boolean;
  isPriceConfirmed: boolean;
}

const CONDITIONS: readonly { value: string; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
] as const;

let nextBulkId = 1;
function generateBulkId(): string {
  return `bulk-${nextBulkId++}-${Date.now()}`;
}

/* ── AI → Web field mapping ───────────────────────────────────────── */

/**
 * Try to match AI clothing type to a web select option.
 * AI might return "Midi Skirt" but web options are "Bottoms", "Tops", etc.
 */
function mapClothingTypeToOption(aiType: string): string {
  const lower = aiType.toLowerCase();
  const mappings: [string[], string][] = [
    [['top', 'shirt', 'blouse', 'tee', 't-shirt', 'tank', 'polo', 'sweater', 'hoodie', 'sweatshirt', 'crop', 'cardigan', 'vest', 'camisole', 'henley', 'tunic'], 'Tops'],
    [['bottom', 'pant', 'jean', 'short', 'skirt', 'trouser', 'legging', 'jogger', 'cargo', 'chino', 'midi', 'mini', 'maxi'], 'Bottoms'],
    [['dress', 'gown', 'romper', 'jumpsuit', 'playsuit'], 'Dresses'],
    [['jacket', 'coat', 'blazer', 'outerwear', 'parka', 'windbreaker', 'poncho', 'cape', 'puffer'], 'Outerwear'],
    [['shoe', 'sneaker', 'boot', 'sandal', 'heel', 'flat', 'loafer', 'slipper', 'mule', 'oxford', 'pump'], 'Shoes'],
    [['bag', 'purse', 'backpack', 'tote', 'clutch', 'satchel', 'crossbody', 'handbag', 'fanny', 'wallet'], 'Bags'],
    [['jewelry', 'necklace', 'bracelet', 'ring', 'earring', 'brooch', 'pendant', 'anklet'], 'Jewelry'],
    [['watch'], 'Watches'],
  ];
  for (const [keywords, option] of mappings) {
    if (keywords.some((kw) => lower.includes(kw))) return option;
  }
  return 'Other accessories';
}

/**
 * Try to match AI size string to a web select option.
 * AI might return "Medium" but web options are "S", "M", "L", etc.
 */
function mapSizeToOption(aiSize: string): string {
  const lower = aiSize.toLowerCase().trim();
  const mappings: [string[], string][] = [
    [['xxs', 'extra extra small', 'double extra small'], 'XXS'],
    [['xs', 'extra small'], 'XS'],
    [['xxxl', '3xl', 'triple extra large'], 'XXXL'],
    [['xxl', '2xl', 'double extra large'], 'XXL'],
    [['xl', 'extra large'], 'XL'],
    [['small'], 'S'],
    [['medium'], 'M'],
    [['large'], 'L'],
    [['one size', 'os', 'one-size', 'free size'], 'One Size'],
  ];
  // Check exact single-letter match first
  if (lower === 's') return 'S';
  if (lower === 'm') return 'M';
  if (lower === 'l') return 'L';
  for (const [keywords, option] of mappings) {
    if (keywords.some((kw) => lower === kw || lower.includes(kw))) return option;
  }
  // If it's a numeric size, extract the number and return it directly
  if (/\d/.test(aiSize)) {
    // Extract the primary number (e.g. "32" from "32W x 30L", "8.5" from "US 8.5")
    const numMatch = aiSize.match(/(\d+\.?\d*)/);
    if (numMatch) return numMatch[1];
  }
  return aiSize;
}

/**
 * Maps AI categoryDetails keys to web categoryFieldValues keys.
 * AI returns: clothing.clothingType, clothing.brand, etc.
 * Web uses: itemType, brand, material, etc.
 * Attempts to fill ALL category fields from available AI data.
 */
function mapCategoryDetailsToFields(
  aiCategory: string,
  details: CategoryDetails
): Record<string, string> {
  const fields: Record<string, string> = {};
  const lowerCat = aiCategory.toLowerCase();

  // Extract brand from any available detail section
  const anyBrand = details.clothing?.brand || details.electronics?.brand || '';
  const anyMaterial = details.clothing?.material || details.furniture?.material || '';

  if (lowerCat.includes('clothing') || lowerCat.includes('accessor')) {
    const d = details.clothing;
    if (d?.clothingType) fields.itemType = mapClothingTypeToOption(d.clothingType);
    if (d?.brand) fields.brand = d.brand;
    if (d?.size) fields.size = mapSizeToOption(d.size);
    if (d?.material) fields.material = d.material;
  } else if (lowerCat.includes('electronic')) {
    const d = details.electronics;
    if (d?.brand) fields.brand = d.brand;
    if (d?.model) fields.model = d.model;
    if (d?.storage) fields.storage = d.storage;
    if (d?.screenSize) fields.itemType = d.screenSize;
  } else if (lowerCat.includes('furniture')) {
    const d = details.furniture;
    if (d?.material) fields.material = d.material;
    if (d?.style) fields.furnitureType = d.style;
  } else if (lowerCat.includes('book') || lowerCat.includes('media')) {
    const d = details.books;
    if (d?.author) fields.authorArtist = d.author;
    if (d?.edition) fields.conditionNotes = d.edition;
    if (d?.subject) fields.format = d.subject;
  } else if (lowerCat.includes('collectible')) {
    const d = details.clothing || details.electronics;
    if (d?.brand) fields.makerBrand = d.brand;
    if (anyMaterial) fields.material = anyMaterial;
  } else if (lowerCat.includes('sport')) {
    if (anyBrand) fields.brand = anyBrand;
    if (details.clothing?.size) fields.size = details.clothing.size;
  } else if (lowerCat.includes('mobility') || lowerCat.includes('ride')) {
    if (anyBrand) fields.brand = anyBrand;
  } else if (lowerCat.includes('kitchen') || lowerCat.includes('home')) {
    if (anyBrand) fields.brand = anyBrand;
    if (anyMaterial) fields.material = anyMaterial;
  } else {
    if (anyBrand) fields.brand = anyBrand;
  }

  return fields;
}

/**
 * Maps AI category name to web category name.
 * AI may return "Clothing" but web uses "Clothing & Accessories", etc.
 */
function mapAiCategoryToWeb(aiCategory: string, webCategories: string[]): string {
  // Exact match first
  if (webCategories.includes(aiCategory)) return aiCategory;

  const lower = aiCategory.toLowerCase();
  // Fuzzy match
  const match = webCategories.find((c) => {
    const cl = c.toLowerCase();
    return cl.includes(lower) || lower.includes(cl) ||
      cl.split(/\s*[&/]\s*/).some((part) => lower.includes(part));
  });

  return match || aiCategory;
}

/**
 * Map AI condition string to our condition value.
 */
function mapConditionValue(aiCondition: string | undefined): string {
  if (!aiCondition) return 'good';
  const lower = aiCondition.toLowerCase();
  if (lower.includes('new') && !lower.includes('like')) return 'new';
  if (lower.includes('like new') || lower.includes('excellent')) return 'like_new';
  if (lower.includes('good')) return 'good';
  if (lower.includes('fair') || lower.includes('used')) return 'fair';
  if (lower.includes('poor') || lower.includes('worn') || lower.includes('damaged')) return 'poor';
  return 'good';
}

/**
 * Build a descriptive item name from base title + category-specific fields.
 * Brand always comes first, then base title, then remaining details.
 */
function buildWebItemName(
  baseTitle: string,
  _categoryValue: string,
  fieldValues: Record<string, string>
): string {
  if (!baseTitle.trim() && Object.values(fieldValues).every((v) => !v.trim())) return '';

  const baseLower = baseTitle.toLowerCase();
  const parts: string[] = [];

  // Brand always comes first (used across most categories)
  const brand = fieldValues.brand || fieldValues.makerBrand || '';
  if (brand && !baseLower.includes(brand.toLowerCase())) {
    parts.push(brand);
  }

  // Add base title
  if (baseTitle.trim()) {
    parts.push(baseTitle.trim());
  }

  // Keys to skip: category-type fields, condition fields, and already-handled brand
  const skipKeys = new Set([
    'brand', 'makerBrand',
    'itemType', 'furnitureType', 'model',       // category-type fields — don't add to title
    'conditionNotes', 'damagePresent', 'workingStatus', 'markingsPresent', 'publicationYear',
  ]);

  // Only append size and material (short, useful details)
  for (const [key, value] of Object.entries(fieldValues)) {
    if (!value || skipKeys.has(key)) continue;
    const valLower = value.toLowerCase();
    if (!baseLower.includes(valLower) && !parts.some((p) => p.toLowerCase().includes(valLower))) {
      if (key === 'size') {
        parts.push(`Size ${value}`);
      } else {
        parts.push(value);
      }
    }
  }

  return parts.join(' ').trim();
}

/* ── Main Page ────────────────────────────────────────────────────── */

export default function UploadPage(): React.ReactElement {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Race condition guard: incremented on each new analysis, stale results discarded */
  const analysisIdRef = useRef<number>(0);

  /* Mode: null = not chosen yet */
  const [mode, setMode] = useState<'single' | 'bulk' | null>(null);

  /* Shared photo state */
  const [allFiles, setAllFiles] = useState<File[]>([]);
  const [allPreviews, setAllPreviews] = useState<string[]>([]);
  const [dragging, setDragging] = useState<boolean>(false);

  /* AI analysis state */
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [analysisApplied, setAnalysisApplied] = useState<boolean>(false);
  const [uploadedPaths, setUploadedPaths] = useState<string[]>([]);

  /* Single-item flow */
  const [singleStep, setSingleStep] = useState<SingleStep>('photos');
  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [condition, setCondition] = useState<string>('good');
  const [notes, setNotes] = useState<string>('');
  const [categoryFieldValues, setCategoryFieldValues] = useState<Record<string, string>>({});
  const [singleBaseTitle, setSingleBaseTitle] = useState<string>('');
  const singleTitleFocusedRef = useRef<boolean>(false);
  const [priceEstimate, setPriceEstimate] = useState<EstimatePriceResponse | null>(null);
  const [priceMin, setPriceMin] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [retailPrice, setRetailPrice] = useState<string>('');
  const [estimating, setEstimating] = useState<boolean>(false);

  /* Bulk flow */
  const [bulkStep, setBulkStep] = useState<BulkStep>('photos');
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([]);
  const [unassignedFiles, setUnassignedFiles] = useState<{ file: File; preview: string }[]>([]);
  const [selectedUnassigned, setSelectedUnassigned] = useState<Set<number>>(new Set());
  const [currentBulkIndex, setCurrentBulkIndex] = useState<number>(0);
  const [bulkEstimating, setBulkEstimating] = useState<boolean>(false);
  const [bulkPublishing, setBulkPublishing] = useState<boolean>(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

  const [error, setError] = useState<string>('');

  const categories: string[] = getAllCategories();

  /* ── Dynamic title building (single flow) ─────────────────────────── */

  useEffect(() => {
    if (mode !== 'single') return;
    // Don't rebuild while user is typing in the title field
    if (singleTitleFocusedRef.current) return;
    const built = buildWebItemName(singleBaseTitle, category, categoryFieldValues);
    if (built.trim()) setTitle(built);
  }, [mode, singleBaseTitle, category, categoryFieldValues]);

  /* ── Dynamic title building (bulk flow) ───────────────────────────── */

  // Track per-item base titles; focused flag prevents rebuild while typing
  const [bulkBaseTitles, setBulkBaseTitles] = useState<Record<string, string>>({});
  const bulkTitleFocusedRef = useRef<boolean>(false);

  useEffect(() => {
    if (mode !== 'bulk' || !currentBulkItem) return;
    if (bulkTitleFocusedRef.current) return;
    const baseTitle = bulkBaseTitles[currentBulkItem.id] || '';
    const built = buildWebItemName(baseTitle, currentBulkItem.category, currentBulkItem.categoryFields);
    if (built.trim()) {
      updateBulkItem(currentBulkIndex, { title: built });
    }
  }, [mode, currentBulkIndex, bulkBaseTitles, bulkItems]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── AI analysis (triggered by button) ────────────────────────────── */

  const runAnalysis = useCallback(async (): Promise<void> => {
    if (!user || allFiles.length === 0) return;

    const currentId = ++analysisIdRef.current;
    setAnalyzing(true);
    setAnalysisApplied(false);
    setError('');

    try {
      const { response, paths, error: analysisError } = await analyzeImages(allFiles, user.id);

      // Race condition guard: discard if a newer analysis started
      if (currentId !== analysisIdRef.current) return;

      if (analysisError) {
        setError(`AI analysis: ${analysisError}`);
        if (paths.length > 0) setUploadedPaths(paths);
        setAnalyzing(false);
        return;
      }

      if (paths.length > 0) setUploadedPaths(paths);

      if (response?.type === 'identified') {
        applyAnalysisResult(response.item, currentId);
      }
      // For needs_clarification, we just stop analyzing and let user fill manually
    } catch {
      if (currentId === analysisIdRef.current) {
        setError('AI analysis failed. Fill in details manually.');
      }
    } finally {
      if (currentId === analysisIdRef.current) {
        setAnalyzing(false);
      }
    }
  }, [user, allFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyAnalysisResult = (item: IdentifiedItem, currentId: number): void => {
    if (currentId !== analysisIdRef.current) return;

    // Map AI category to web category
    const mappedCategory = mapAiCategoryToWeb(item.category, categories);

    // Set base title for dynamic building
    setSingleBaseTitle(item.title || '');
    setTitle(item.title || '');
    setCategory(mappedCategory);
    setCondition(mapConditionValue(item.condition));

    // Map category details to field values
    const mappedFields = item.categoryDetails
      ? mapCategoryDetailsToFields(mappedCategory, item.categoryDetails)
      : {};

    // If itemType not set from categoryDetails, try to infer from title
    if (!mappedFields.itemType && !mappedFields.furnitureType && !mappedFields.collectibleType && !mappedFields.format) {
      if (item.title) {
        const lowerMapped = mappedCategory.toLowerCase();
        if (lowerMapped.includes('clothing') || lowerMapped.includes('accessor')) {
          mappedFields.itemType = mapClothingTypeToOption(item.title);
        } else {
          mappedFields.itemType = item.title;
        }
      }
    }
    setCategoryFieldValues(mappedFields);

    setAnalysisApplied(true);
  };

  /* ── File handling ──────────────────────────────────────────────── */

  const addFiles = useCallback((newFiles: FileList | File[]): void => {
    const fileArray: File[] = Array.from(newFiles).filter((f) => f.type.startsWith('image/'));
    setAllFiles((prev) => [...prev, ...fileArray]);
    const newPreviews: string[] = fileArray.map((f) => URL.createObjectURL(f));
    setAllPreviews((prev) => [...prev, ...newPreviews]);
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files) addFiles(e.target.files);
  };

  const handleDrop = (e: DragEvent): void => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  const removeFile = (index: number): void => {
    URL.revokeObjectURL(allPreviews[index]);
    setAllFiles((prev) => prev.filter((_, i) => i !== index));
    setAllPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  /* ── Mode selection ─────────────────────────────────────────────── */

  const startSingleFlow = (): void => {
    setMode('single');
    setSingleStep('details');
  };

  const startBulkFlow = (): void => {
    setMode('bulk');
    setBulkStep('grouping');
    const pool = allFiles.map((file, i) => ({ file, preview: allPreviews[i] }));
    setUnassignedFiles(pool);
    setSelectedUnassigned(new Set());
    setBulkItems([]);
  };

  const startBulkFlowAutoGrouped = (): void => {
    setMode('bulk');
    setBulkStep('grouping');
    // Auto-group: each photo becomes its own item
    const autoItems: BulkItem[] = allFiles.map((file, i) => ({
      id: generateBulkId(),
      files: [file],
      previews: [allPreviews[i]],
      uploadedPaths: [],
      title: '',
      category: '',
      condition: 'good',
      notes: '',
      categoryFields: {},
      priceEstimate: null,
      minPrice: '',
      retailPrice: '',
      isVerified: false,
      isPriceConfirmed: false,
    }));
    setBulkItems(autoItems);
    setUnassignedFiles([]);
    setSelectedUnassigned(new Set());
  };

  const startNoPhotoFlow = (): void => {
    setMode('single');
    setSingleStep('details');
    // Clear any previously added photos
    allPreviews.forEach((url) => URL.revokeObjectURL(url));
    setAllFiles([]);
    setAllPreviews([]);
  };

  /* ── Single-item: Details → Price ───────────────────────────────── */

  const handleSingleDetailsNext = (): void => {
    setError('');
    setSingleStep('price');
  };

  const handleSinglePriceEstimate = async (): Promise<void> => {
    setEstimating(true);
    setError('');

    const estimate: EstimatePriceResponse | null = await estimatePrice({
      title: title.trim(),
      category,
      condition,
      description: notes.trim() || undefined,
      categoryFields: categoryFieldValues,
    });

    setPriceEstimate(estimate);
    if (estimate) {
      setPriceMin(String(estimate.market_value_min));
      setPriceMax(String(estimate.market_value_max));
      setRetailPrice(String(estimate.estimated_retail_price || Math.round(estimate.market_value_max * 1.5)));
    } else {
      setError('Price estimate failed. You can enter prices manually.');
    }
    setEstimating(false);
  };

  /* ── Single-item: Submit ────────────────────────────────────────── */

  const handleSingleSubmit = async (): Promise<void> => {
    if (!user) return;
    setSingleStep('submitting');
    setError('');

    try {
      // Use already-uploaded paths from analysis if available, otherwise upload now
      let paths = uploadedPaths;
      if (allFiles.length === 0) {
        // No photos — text-only listing
        paths = [];
      } else if (paths.length === 0) {
        const result = await uploadImages(allFiles, user.id);
        if (result.errors.length > 0) {
          setError(result.errors.join('; '));
          setSingleStep('price');
          return;
        }
        paths = result.paths;
      }

      const { error: createError } = await createItem({
        title: title.trim(),
        category,
        condition,
        photos: paths,
        estimated_value_min: priceMin ? parseFloat(priceMin) : priceEstimate?.market_value_min,
        estimated_value_max: priceMax ? parseFloat(priceMax) : priceEstimate?.market_value_max,
        retail_price: retailPrice ? parseFloat(retailPrice) : undefined,
        min_price: minPrice ? parseFloat(minPrice) : undefined,
        notes: notes.trim() || undefined,
        description: notes.trim() || undefined,
      });

      if (createError) {
        setError(createError);
        setSingleStep('price');
        return;
      }

      router.push('/my-list');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
      setSingleStep('price');
    }
  };

  /* ── Bulk: Grouping handlers ────────────────────────────────────── */

  const toggleUnassigned = (index: number): void => {
    setSelectedUnassigned((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const createGroup = (): void => {
    if (selectedUnassigned.size === 0) return;
    const selectedIndices: number[] = Array.from(selectedUnassigned).sort((a, b) => a - b);
    const groupFiles: File[] = selectedIndices.map((i) => unassignedFiles[i].file);
    const groupPreviews: string[] = selectedIndices.map((i) => unassignedFiles[i].preview);

    const newItem: BulkItem = {
      id: generateBulkId(),
      files: groupFiles,
      previews: groupPreviews,
      uploadedPaths: [],
      title: '',
      category: '',
      condition: 'good',
      notes: '',
      categoryFields: {},
      priceEstimate: null,
      minPrice: '',
      retailPrice: '',
      isVerified: false,
      isPriceConfirmed: false,
    };

    setBulkItems((prev) => [...prev, newItem]);
    setUnassignedFiles((prev) => prev.filter((_, i) => !selectedUnassigned.has(i)));
    setSelectedUnassigned(new Set());
  };

  const ungroupItem = (itemId: string): void => {
    const item: BulkItem | undefined = bulkItems.find((b) => b.id === itemId);
    if (!item) return;
    const returned = item.files.map((file, i) => ({ file, preview: item.previews[i] }));
    setUnassignedFiles((prev) => [...prev, ...returned]);
    setBulkItems((prev) => prev.filter((b) => b.id !== itemId));
  };

  const [selectedGroupItems, setSelectedGroupItems] = useState<Set<string>>(new Set());

  const toggleGroupItem = (itemId: string): void => {
    setSelectedGroupItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const mergeSelectedItems = (): void => {
    if (selectedGroupItems.size < 2) return;
    const selectedIds: string[] = Array.from(selectedGroupItems);
    const itemsToMerge: BulkItem[] = bulkItems.filter((b) => selectedIds.includes(b.id));
    const remaining: BulkItem[] = bulkItems.filter((b) => !selectedIds.includes(b.id));

    const mergedItem: BulkItem = {
      id: generateBulkId(),
      files: itemsToMerge.flatMap((item) => item.files),
      previews: itemsToMerge.flatMap((item) => item.previews),
      uploadedPaths: [],
      title: '',
      category: '',
      condition: 'good',
      notes: '',
      categoryFields: {},
      priceEstimate: null,
      minPrice: '',
      retailPrice: '',
      isVerified: false,
      isPriceConfirmed: false,
    };

    setBulkItems([...remaining, mergedItem]);
    setSelectedGroupItems(new Set());
  };

  const autoGroupRemaining = (): void => {
    const newItems: BulkItem[] = unassignedFiles.map((u) => ({
      id: generateBulkId(),
      files: [u.file],
      previews: [u.preview],
      uploadedPaths: [],
      title: '',
      category: '',
      condition: 'good',
      notes: '',
      categoryFields: {},
      priceEstimate: null,
      minPrice: '',
      retailPrice: '',
      isVerified: false,
      isPriceConfirmed: false,
    }));
    setBulkItems((prev) => [...prev, ...newItems]);
    setUnassignedFiles([]);
    setSelectedUnassigned(new Set());
  };

  const proceedToVerify = (): void => {
    setCurrentBulkIndex(0);
    setBulkStep('verify');
    setError('');
  };

  /* ── Bulk: Add/Remove photos for current item ─────────────────── */

  const bulkPhotoInputRef = useRef<HTMLInputElement>(null);

  const addPhotosToBulkItem = useCallback((newFiles: FileList | File[]): void => {
    const fileArray: File[] = Array.from(newFiles).filter((f) => f.type.startsWith('image/'));
    if (fileArray.length === 0 || currentBulkIndex < 0) return;
    const newPreviews: string[] = fileArray.map((f) => URL.createObjectURL(f));
    setBulkItems((prev) => prev.map((item, i) =>
      i === currentBulkIndex
        ? { ...item, files: [...item.files, ...fileArray], previews: [...item.previews, ...newPreviews], uploadedPaths: [] }
        : item
    ));
  }, [currentBulkIndex]);

  const removePhotoFromBulkItem = (photoIndex: number): void => {
    const item = bulkItems[currentBulkIndex];
    if (!item || item.files.length <= 1) return; // Must keep at least 1 photo
    URL.revokeObjectURL(item.previews[photoIndex]);
    updateBulkItem(currentBulkIndex, {
      files: item.files.filter((_, i) => i !== photoIndex),
      previews: item.previews.filter((_, i) => i !== photoIndex),
      uploadedPaths: [], // Reset uploaded paths since photos changed
    });
  };

  /* ── Bulk: AI Analyze for current item ──────────────────────────── */

  const [bulkAnalyzing, setBulkAnalyzing] = useState<boolean>(false);
  const [bulkAnalysisApplied, setBulkAnalysisApplied] = useState<Record<string, boolean>>({});
  const bulkAnalysisIdRef = useRef<number>(0);

  /* ── Bulk: AI Analyze All items ─────────────────────────────────── */
  const [bulkAnalyzeAllRunning, setBulkAnalyzeAllRunning] = useState<boolean>(false);
  const [bulkAnalyzeAllProgress, setBulkAnalyzeAllProgress] = useState<{ current: number; total: number } | null>(null);
  const bulkAnalyzeAllCancelRef = useRef<boolean>(false);

  const runAnalyzeAll = useCallback(async (): Promise<void> => {
    if (!user || bulkItems.length === 0) return;
    setBulkAnalyzeAllRunning(true);
    setBulkAnalyzeAllProgress({ current: 0, total: bulkItems.length });
    bulkAnalyzeAllCancelRef.current = false;
    setError('');

    let failCount = 0;
    for (let i = 0; i < bulkItems.length; i++) {
      if (bulkAnalyzeAllCancelRef.current) break;
      const item = bulkItems[i];
      if (item.files.length === 0) continue;

      setBulkAnalyzeAllProgress({ current: i + 1, total: bulkItems.length });

      try {
        const { response, paths, error: analysisError } = await analyzeImages(item.files, user.id);

        if (bulkAnalyzeAllCancelRef.current) break;

        if (paths.length > 0) {
          setBulkItems((prev) => prev.map((b, idx) => idx === i ? { ...b, uploadedPaths: paths } : b));
        }

        if (analysisError) {
          failCount++;
          continue;
        }

        if (response?.type === 'identified') {
          const mappedCategory = mapAiCategoryToWeb(response.item.category, categories);
          const mappedFields = response.item.categoryDetails
            ? mapCategoryDetailsToFields(mappedCategory, response.item.categoryDetails)
            : {};

          if (!mappedFields.itemType && !mappedFields.furnitureType && !mappedFields.collectibleType && !mappedFields.format) {
            if (response.item.title) {
              const lowerMapped = mappedCategory.toLowerCase();
              if (lowerMapped.includes('clothing') || lowerMapped.includes('accessor')) {
                mappedFields.itemType = mapClothingTypeToOption(response.item.title);
              } else {
                mappedFields.itemType = response.item.title;
              }
            }
          }

          setBulkBaseTitles((prev) => ({ ...prev, [item.id]: response.item.title || '' }));
          setBulkItems((prev) => prev.map((b, idx) => idx === i ? {
            ...b,
            title: response.item.title || '',
            category: mappedCategory,
            condition: mapConditionValue(response.item.condition),
            categoryFields: mappedFields,
            uploadedPaths: paths.length > 0 ? paths : b.uploadedPaths,
          } : b));
          setBulkAnalysisApplied((prev) => ({ ...prev, [item.id]: true }));
        }
      } catch {
        failCount++;
      }
    }

    if (failCount > 0 && !bulkAnalyzeAllCancelRef.current) {
      setError(`AI analysis failed for ${failCount} of ${bulkItems.length} items. You can edit them manually.`);
    }
    setBulkAnalyzeAllRunning(false);
    setBulkAnalyzeAllProgress(null);
  }, [user, bulkItems, categories]); // eslint-disable-line react-hooks/exhaustive-deps

  const runBulkAnalysis = useCallback(async (): Promise<void> => {
    const item: BulkItem | undefined = bulkItems[currentBulkIndex];
    if (!user || !item || item.files.length === 0) return;

    const currentId = ++bulkAnalysisIdRef.current;
    const itemId = item.id;
    setBulkAnalyzing(true);
    setBulkAnalysisApplied((prev) => ({ ...prev, [itemId]: false }));
    setError('');

    try {
      const { response, paths, error: analysisError } = await analyzeImages(item.files, user.id);

      if (currentId !== bulkAnalysisIdRef.current) return;

      if (paths.length > 0) {
        updateBulkItem(currentBulkIndex, { uploadedPaths: paths });
      }

      if (analysisError) {
        setError(`AI analysis: ${analysisError}`);
        setBulkAnalyzing(false);
        return;
      }

      if (response?.type === 'identified') {
        const mappedCategory = mapAiCategoryToWeb(response.item.category, categories);
        const mappedFields = response.item.categoryDetails
          ? mapCategoryDetailsToFields(mappedCategory, response.item.categoryDetails)
          : {};

        // If itemType not set from categoryDetails, try to infer from title
        if (!mappedFields.itemType && !mappedFields.furnitureType && !mappedFields.collectibleType && !mappedFields.format) {
          if (response.item.title) {
            const lowerMapped = mappedCategory.toLowerCase();
            if (lowerMapped.includes('clothing') || lowerMapped.includes('accessor')) {
              mappedFields.itemType = mapClothingTypeToOption(response.item.title);
            } else {
              mappedFields.itemType = response.item.title;
            }
          }
        }

        setBulkBaseTitles((prev) => ({ ...prev, [itemId]: response.item.title || '' }));
        updateBulkItem(currentBulkIndex, {
          title: response.item.title || '',
          category: mappedCategory,
          condition: mapConditionValue(response.item.condition),
          categoryFields: mappedFields,
        });
        setBulkAnalysisApplied((prev) => ({ ...prev, [itemId]: true }));
      }
    } catch {
      if (currentId === bulkAnalysisIdRef.current) {
        setError('AI analysis failed. Fill in details manually.');
      }
    } finally {
      if (currentId === bulkAnalysisIdRef.current) {
        setBulkAnalyzing(false);
      }
    }
  }, [user, bulkItems, currentBulkIndex, categories]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Bulk: Verification & Pricing ───────────────────────────────── */

  const updateBulkItem = (index: number, updates: Partial<BulkItem>): void => {
    setBulkItems((prev) => prev.map((item, i) => i === index ? { ...item, ...updates } : item));
  };

  const removeBulkItem = (index: number): void => {
    setBulkItems((prev) => prev.filter((_, i) => i !== index));
    if (currentBulkIndex >= bulkItems.length - 1) {
      setCurrentBulkIndex(Math.max(0, bulkItems.length - 2));
    }
  };

  const handleBulkVerifyNext = (): void => {
    setError('');
    updateBulkItem(currentBulkIndex, { isVerified: true });
    setBulkStep('bulkPrice');
  };

  const handleBulkPriceEstimate = async (): Promise<void> => {
    const item: BulkItem = bulkItems[currentBulkIndex];
    setBulkEstimating(true);
    setError('');

    const estimate: EstimatePriceResponse | null = await estimatePrice({
      title: item.title.trim(),
      category: item.category,
      condition: item.condition,
      description: item.notes.trim() || undefined,
      categoryFields: item.categoryFields,
    });

    updateBulkItem(currentBulkIndex, {
      priceEstimate: estimate,
      retailPrice: estimate ? String(estimate.estimated_retail_price || Math.round(estimate.market_value_max * 1.5)) : '',
    });
    setBulkEstimating(false);
  };

  const handleBulkPriceNext = (): void => {
    updateBulkItem(currentBulkIndex, { isPriceConfirmed: true });

    if (currentBulkIndex < bulkItems.length - 1) {
      setCurrentBulkIndex(currentBulkIndex + 1);
      setBulkStep('verify');
      setError('');
    } else {
      setBulkStep('summary');
      setError('');
    }
  };

  /* ── Bulk: Publish Single Item ──────────────────────────────────── */

  const publishSingleBulkItem = async (): Promise<void> => {
    if (!user || !currentBulkItem) return;
    setBulkPublishing(true);
    setError('');

    try {
      // Upload photos for this item
      let paths = currentBulkItem.uploadedPaths;
      if (paths.length === 0 && currentBulkItem.files.length > 0) {
        const result = await uploadImages(currentBulkItem.files, user.id);
        if (result.errors.length > 0) {
          setError(result.errors.join('; '));
          setBulkPublishing(false);
          return;
        }
        paths = result.paths;
      }

      const { error: createError } = await createItem({
        title: currentBulkItem.title.trim(),
        category: currentBulkItem.category,
        condition: currentBulkItem.condition,
        photos: paths,
        estimated_value_min: currentBulkItem.priceEstimate?.market_value_min,
        estimated_value_max: currentBulkItem.priceEstimate?.market_value_max,
        retail_price: currentBulkItem.retailPrice ? parseFloat(currentBulkItem.retailPrice) : undefined,
        min_price: currentBulkItem.minPrice ? parseFloat(currentBulkItem.minPrice) : undefined,
        notes: currentBulkItem.notes.trim() || undefined,
        description: currentBulkItem.notes.trim() || undefined,
      });

      if (createError) {
        setError(createError);
        setBulkPublishing(false);
        return;
      }

      // Remove the published item from bulkItems
      const remaining = bulkItems.filter((_, i) => i !== currentBulkIndex);
      setBulkItems(remaining);

      if (remaining.length === 0) {
        // Last item published, redirect
        window.location.href = '/my-list';
      } else {
        // Adjust index and go to verify step for next item
        const nextIndex = currentBulkIndex >= remaining.length ? remaining.length - 1 : currentBulkIndex;
        setCurrentBulkIndex(nextIndex);
        setBulkStep('verify');
        setError('');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setBulkPublishing(false);
    }
  };

  /* ── Bulk: Submit All ───────────────────────────────────────────── */

  const handleBulkSubmit = async (): Promise<void> => {
    if (!user) return;
    setBulkStep('submitting');
    setError('');
    setBulkProgress({ current: 0, total: bulkItems.length });

    let successCount = 0;
    const failedItems: string[] = [];

    for (let i = 0; i < bulkItems.length; i++) {
      const item: BulkItem = bulkItems[i];
      setBulkProgress({ current: i + 1, total: bulkItems.length });

      try {
        // Use pre-uploaded paths if available
        let paths = item.uploadedPaths;
        if (paths.length === 0) {
          const result = await uploadImages(item.files, user.id);
          if (result.errors.length > 0) {
            failedItems.push(`${item.title}: ${result.errors.join(', ')}`);
            continue;
          }
          paths = result.paths;
        }

        const { error: createError } = await createItem({
          title: item.title.trim(),
          category: item.category,
          condition: item.condition,
          photos: paths,
          estimated_value_min: item.priceEstimate?.market_value_min,
          estimated_value_max: item.priceEstimate?.market_value_max,
          retail_price: item.retailPrice ? parseFloat(item.retailPrice) : undefined,
          min_price: item.minPrice ? parseFloat(item.minPrice) : undefined,
          notes: item.notes.trim() || undefined,
          description: item.notes.trim() || undefined,
        });

        if (createError) {
          failedItems.push(`${item.title}: ${createError}`);
        } else {
          successCount++;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        failedItems.push(`${item.title}: ${message}`);
      }
    }

    if (failedItems.length > 0 && successCount === 0) {
      setError(`All items failed: ${failedItems.join('; ')}`);
      setBulkStep('summary');
      return;
    }

    if (failedItems.length > 0) {
      setError(`${successCount} listed, ${failedItems.length} failed: ${failedItems.join('; ')}`);
    }

    // Use window.location for reliable redirect after bulk publish
    window.location.href = '/my-list';
  };

  /* ── Derived state ──────────────────────────────────────────────── */

  const currentBulkItem: BulkItem | null = bulkItems[currentBulkIndex] || null;
  const currentDynamicFields = currentBulkItem?.category ? getCategoryFields(currentBulkItem.category) : [];
  const singleDynamicFields = category ? getCategoryFields(category) : [];
  const allVerifiedAndPriced: boolean = bulkItems.every((b) => b.isVerified && b.isPriceConfirmed);
  const totalEstimatedValue: number = bulkItems.reduce((sum, b) => {
    if (!b.priceEstimate) return sum;
    return sum + Math.round((b.priceEstimate.market_value_min + b.priceEstimate.market_value_max) / 2);
  }, 0);

  /* ── Step indicator ─────────────────────────────────────────────── */

  const activeStep: string = mode === 'bulk' ? bulkStep : singleStep;

  const stepTitle = (): string => {
    if (activeStep === 'photos') return 'Add items';
    if (mode === 'single') {
      if (singleStep === 'details') return 'Item details';
      if (singleStep === 'price') return 'Review & Add';
      return '';
    }
    if (bulkStep === 'grouping') return 'Group Photos';
    if (bulkStep === 'verify') return `Item ${currentBulkIndex + 1} of ${bulkItems.length}`;
    if (bulkStep === 'bulkPrice') return `Price ${currentBulkIndex + 1}/${bulkItems.length}`;
    if (bulkStep === 'summary') return 'Review & Add All';
    return '';
  };

  /* ── Render ─────────────────────────────────────────────────────── */

  return (
    <PageContainer className="max-w-2xl">
      {stepTitle() && <div className="mb-2xl flex items-center justify-between">
        <h1 className="font-heading text-h1 text-text-primary">{stepTitle()}</h1>
        {/* AI Analyze button - top right, shown on details step when photos exist */}
        {mode === 'single' && singleStep === 'details' && allFiles.length > 0 && (
          analyzing ? (
            <div className="flex items-center gap-sm rounded-md border border-accent bg-accent-soft/50 px-md py-sm">
              <Spinner size="sm" />
              <span className="text-xs text-text-secondary">Analyzing...</span>
            </div>
          ) : (
            <button
              onClick={runAnalysis}
              disabled={allFiles.length === 0}
              className="flex items-center gap-xs rounded-md border border-accent bg-accent-soft px-md py-sm text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-white disabled:opacity-50"
            >
              ✨ AI Analyze
            </button>
          )
        )}
      </div>}

      {error && (
        <div className="mb-lg rounded-md bg-danger-soft px-lg py-md text-sm text-danger">{error}</div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ── Step 1: Add Photos (shared) ─────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeStep === 'photos' && (
        <div className="space-y-xl">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-huge transition-colors ${
              dragging ? 'border-accent bg-accent-soft' : 'border-border hover:border-text-muted'
            }`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-text-muted text-2xl text-text-muted">+</div>
            <p className="mt-md text-md font-medium text-text-primary">
              Click to add photos
            </p>
            <p className="mt-xs text-sm text-text-muted">or drag & drop photos here</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="w-full">
            Browse files
          </Button>

          {allPreviews.length === 0 && (
            <div className="mt-xl text-center">
              <button onClick={startNoPhotoFlow} className="text-sm text-text-secondary hover:text-accent underline">
                List without photos (e.g., tickets, services)
              </button>
            </div>
          )}

          {allPreviews.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-text-secondary">
                  {allFiles.length} photo{allFiles.length !== 1 ? 's' : ''} selected
                </p>
                <p className="text-xs text-text-muted">Hover a photo to remove it</p>
              </div>

              <div className="grid grid-cols-3 gap-md sm:grid-cols-4">
                {allPreviews.map((url, i) => (
                  <div key={i} className="group relative aspect-square overflow-hidden rounded-md border border-border">
                    <img src={url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                    <div className="absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-[10px] text-white">
                      {i + 1}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-danger text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      &times;
                    </button>
                  </div>
                ))}

                {/* Add more button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex aspect-square items-center justify-center rounded-md border-2 border-dashed border-border text-2xl text-text-muted hover:border-accent hover:text-accent"
                >
                  +
                </button>
              </div>

              <div className="space-y-md">
                <Button onClick={startBulkFlowAutoGrouped} className="w-full">
                  Continue with {allFiles.length} item{allFiles.length !== 1 ? 's' : ''} →
                </Button>
                <p className="text-center text-xs text-text-muted">Each photo becomes its own item. You can combine photos in the next step.</p>
                {allFiles.length > 1 && (
                  <Button variant="secondary" onClick={startSingleFlow} className="w-full">
                    Treat all as 1 item
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ── Single Item: Details ────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {mode === 'single' && singleStep === 'details' && (
        <div className="space-y-lg">
          <button onClick={() => { setMode(null); setSingleStep('photos'); }} className="text-sm text-text-secondary hover:text-text-primary">
            ← Back to photos
          </button>

          {/* Compact photo strip */}
          {allPreviews.length > 0 && (
            <div className="flex gap-sm overflow-x-auto pb-sm">
              {allPreviews.map((url, i) => (
                <div key={i} className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-md border border-border">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}

          {/* AI applied indicator */}
          {analysisApplied && (
            <div className="flex items-center justify-between rounded-md border border-success bg-success-soft/50 px-lg py-sm">
              <div className="flex items-center gap-sm">
                <span className="text-success">&#10003;</span>
                <p className="text-xs text-text-secondary">Fields auto-filled by AI</p>
              </div>
              <button onClick={runAnalysis} className="text-xs text-accent hover:underline">Re-analyze</button>
            </div>
          )}

          {/* Item name — editing updates the base title; category fields auto-append */}
          <div>
            <label className="mb-sm block text-xs font-medium uppercase tracking-wide text-text-muted">Item Name</label>
            <input type="text" value={title} onChange={(e) => {
                setSingleBaseTitle(e.target.value);
                setTitle(e.target.value);
              }}
              onFocus={() => { singleTitleFocusedRef.current = true; }}
              onBlur={() => {
                singleTitleFocusedRef.current = false;
                // Rebuild title with category fields on blur
                const built = buildWebItemName(singleBaseTitle, category, categoryFieldValues);
                if (built.trim()) setTitle(built);
              }}
              placeholder="What are you selling?"
              className="w-full rounded-md border border-border bg-card px-md py-md text-md text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none" />
          </div>

          {/* Category */}
          <div>
            <label className="mb-sm block text-xs font-medium uppercase tracking-wide text-text-muted">Category</label>
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setCategoryFieldValues({}); }}
              className="w-full rounded-md border border-border bg-card px-md py-md text-md text-text-primary focus:border-accent focus:outline-none"
            >
              <option value="">Select a category...</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Category-specific fields */}
          {singleDynamicFields.length > 0 && (
            <div className="space-y-md rounded-md border border-border bg-card/50 p-lg">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{category} Details</p>
              <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
                {singleDynamicFields.map((field) => (
                  <div key={field.key}>
                    <label className="mb-xs block text-sm text-text-secondary">
                      {field.label}
                    </label>
                    {field.type === 'select' ? (
                      <select value={categoryFieldValues[field.key] || ''}
                        onChange={(e) => setCategoryFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        className="w-full rounded-md border border-border bg-card px-md py-sm text-sm text-text-primary focus:border-accent focus:outline-none">
                        <option value="">{field.placeholder || 'Select...'}</option>
                        {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type={field.type} value={categoryFieldValues[field.key] || ''}
                        onChange={(e) => setCategoryFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="w-full rounded-md border border-border bg-card px-md py-sm text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Condition */}
          <div>
            <label className="mb-sm block text-xs font-medium uppercase tracking-wide text-text-muted">Condition</label>
            <div className="flex flex-wrap gap-sm">
              {CONDITIONS.map((c) => (
                <button key={c.value} type="button" onClick={() => setCondition(c.value)}
                  className={`rounded-pill border px-lg py-sm text-sm transition-colors ${
                    condition === c.value ? 'border-accent bg-accent text-white' : 'border-border bg-card text-text-primary hover:bg-accent-soft'
                  }`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-sm block text-xs font-medium uppercase tracking-wide text-text-muted">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Any details buyers should know..."
              rows={3}
              className="w-full resize-none rounded-md border border-border bg-card px-md py-md text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none" />
          </div>

          {/* Browse preview — shows exactly what buyers will see */}
          {(title.trim() || category || allPreviews.length > 0) && (
            <div>
              <label className="mb-sm block text-xs font-medium uppercase tracking-wide text-text-muted">Browse Preview</label>
              <div className="w-48 overflow-hidden rounded-md border border-border bg-card shadow-sm">
                <div className="relative aspect-square bg-accent-soft">
                  {allPreviews[0] ? (
                    <img src={allPreviews[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl text-text-muted">{'\u{1F4E6}'}</div>
                  )}
                </div>
                <div className="p-md">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {title.trim() || 'Untitled Item'}
                  </p>
                  <div className="mt-xs flex flex-wrap gap-xs">
                    {category && <Badge variant="neutral">{category}</Badge>}
                    {condition && (
                      <Badge variant="info">{CONDITIONS.find((c) => c.value === condition)?.label || condition}</Badge>
                    )}
                  </div>
                  <p className="mt-sm text-xs text-text-muted italic">Price added next step</p>
                </div>
              </div>
            </div>
          )}

          <Button onClick={handleSingleDetailsNext} className="w-full">Continue</Button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ── Single Item: Review & Add ──────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {mode === 'single' && singleStep === 'price' && (
        <div className="space-y-xl">
          <div className="flex items-center justify-between">
            <button onClick={() => setSingleStep('details')} className="text-sm text-text-secondary hover:text-text-primary">
              ← Back to details
            </button>
            {estimating ? (
              <div className="flex items-center gap-sm rounded-md border border-accent bg-accent-soft/50 px-md py-sm">
                <Spinner size="sm" />
                <span className="text-xs text-text-secondary">Estimating...</span>
              </div>
            ) : (
              <button
                onClick={handleSinglePriceEstimate}
                className="flex items-center gap-xs rounded-md border border-accent bg-accent-soft px-md py-sm text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-white"
              >
                {priceEstimate ? '✨ Re-estimate' : '✨ Price Estimate'}
              </button>
            )}
          </div>

          {/* Compact item card */}
          <div className="flex items-center gap-md rounded-md border border-border bg-card p-md">
            {allPreviews[0] && (
              <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-md">
                <img src={allPreviews[0]} alt="" className="h-full w-full object-cover" />
              </div>
            )}
            <div className="flex flex-wrap gap-sm">
              <Badge variant="blue">{CONDITIONS.find((c) => c.value === condition)?.label}</Badge>
              <Badge variant="neutral">{category}</Badge>
            </div>
          </div>

          {/* Editable title */}
          <div>
            <label className="mb-sm block text-xs font-medium uppercase tracking-wide text-text-muted">Item Name</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-md py-md text-md text-text-primary focus:border-accent focus:outline-none" />
          </div>

          {/* AI estimate reasoning */}
          {!estimating && priceEstimate && priceEstimate.reasoning && (
            <div className="rounded-md border border-border bg-accent-soft/30 p-md">
              <p className="text-xs text-text-muted">{priceEstimate.reasoning}</p>
            </div>
          )}

          {/* Price Range */}
          <div>
            <label className="mb-sm block text-xs font-medium uppercase tracking-wide text-text-muted">Price Range</label>
            <div className="flex gap-md">
              <div className="relative flex-1">
                <span className="absolute left-md top-1/2 -translate-y-1/2 text-text-muted">$</span>
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={priceMin} onChange={(e) => setPriceMin(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Min"
                  className="w-full rounded-md border border-border bg-card py-md pl-8 pr-md text-md text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none" />
              </div>
              <span className="flex items-center text-text-muted">–</span>
              <div className="relative flex-1">
                <span className="absolute left-md top-1/2 -translate-y-1/2 text-text-muted">$</span>
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={priceMax} onChange={(e) => setPriceMax(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Max"
                  className="w-full rounded-md border border-border bg-card py-md pl-8 pr-md text-md text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none" />
              </div>
            </div>
          </div>

          {/* Original Purchase Price */}
          <div>
            <label className="mb-sm block text-xs font-medium uppercase tracking-wide text-text-muted">Original Purchase Price</label>
            <div className="relative">
              <span className="absolute left-md top-1/2 -translate-y-1/2 text-text-muted">$</span>
              <input type="text" inputMode="numeric" pattern="[0-9]*" value={retailPrice} onChange={(e) => setRetailPrice(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="What you originally paid"
                className="w-full rounded-md border border-border bg-card py-md pl-8 pr-md text-md text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none" />
            </div>
          </div>

          {/* Min price */}
          <div>
            <label className="mb-sm block text-xs font-medium uppercase tracking-wide text-text-muted">Minimum Price (optional)</label>
            <div className="relative">
              <span className="absolute left-md top-1/2 -translate-y-1/2 text-text-muted">$</span>
              <input type="text" inputMode="numeric" pattern="[0-9]*" value={minPrice} onChange={(e) => setMinPrice(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Set a floor price"
                className="w-full rounded-md border border-border bg-card py-md pl-8 pr-md text-md text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none" />
            </div>
          </div>

          <Button onClick={handleSingleSubmit} className="w-full">Add to My List</Button>
        </div>
      )}

      {/* ── Single: Submitting ────────────────────────────────────── */}
      {mode === 'single' && singleStep === 'submitting' && (
        <div className="flex flex-col items-center py-huge">
          <Spinner size="lg" />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ── Bulk: Group Photos ─────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {mode === 'bulk' && bulkStep === 'grouping' && (
        <div className="space-y-xl">
          <button onClick={() => { setMode(null); setBulkStep('photos'); }} className="text-sm text-text-secondary hover:text-text-primary">
            ← Back to photos
          </button>

          {/* Unassigned photos */}
          {unassignedFiles.length > 0 && (
            <div>
              <h3 className="mb-sm text-sm font-medium text-text-secondary">
                Unassigned Photos ({unassignedFiles.length})
              </h3>
              <div className="flex gap-sm overflow-x-auto pb-sm">
                {unassignedFiles.map((u, i) => (
                  <button key={i} type="button" onClick={() => toggleUnassigned(i)}
                    className={`relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
                      selectedUnassigned.has(i) ? 'border-accent ring-2 ring-accent/30' : 'border-border hover:border-text-muted'
                    }`}>
                    <img src={u.preview} alt="" className="h-full w-full object-cover" />
                    {selectedUnassigned.has(i) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-accent/20">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs text-white">✓</div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {selectedUnassigned.size > 0 && (
                <Button variant="secondary" onClick={createGroup} className="mt-md">
                  Create Group ({selectedUnassigned.size} photo{selectedUnassigned.size !== 1 ? 's' : ''})
                </Button>
              )}
            </div>
          )}

          {unassignedFiles.length === 0 && bulkItems.length > 0 && (
            <div className="rounded-md border border-border bg-card/50 p-lg text-center text-sm text-text-muted">
              Each photo is its own item. Select items below to combine multiple photos into one item.
            </div>
          )}

          {/* Grouped items */}
          {bulkItems.length > 0 && (
            <div>
              <div className="mb-sm flex items-center justify-between">
                <h3 className="text-sm font-medium text-text-secondary">
                  Items ({bulkItems.length})
                </h3>
                {selectedGroupItems.size >= 2 && (
                  <Button variant="secondary" onClick={mergeSelectedItems} className="text-xs">
                    Combine {selectedGroupItems.size} items into 1
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-md sm:grid-cols-3 md:grid-cols-4">
                {bulkItems.map((item, i) => {
                  const isSelected: boolean = selectedGroupItems.has(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleGroupItem(item.id)}
                      className={`cursor-pointer overflow-hidden rounded-md border-2 bg-card transition-colors ${
                        isSelected ? 'border-accent ring-2 ring-accent/30' : 'border-border hover:border-text-muted'
                      }`}
                    >
                      <div className="relative aspect-square bg-accent-soft">
                        <img src={item.previews[0]} alt="" className="h-full w-full object-cover" />
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center bg-accent/20">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm text-white">✓</div>
                          </div>
                        )}
                        {item.files.length > 1 && (
                          <div className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                            {item.files.length} photos
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between p-sm">
                        <div className="flex items-center gap-xs">
                          <Badge variant="primary">Item {i + 1}</Badge>
                          {bulkAnalysisApplied[item.id] && (
                            <span className="text-xs text-success" title="AI analyzed">&#10003;</span>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); ungroupItem(item.id); }}
                          className="text-[10px] text-text-muted hover:text-danger"
                        >
                          split
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {selectedGroupItems.size === 1 && (
                <p className="mt-sm text-center text-xs text-text-muted">Select another item to combine them</p>
              )}
            </div>
          )}

          {/* Info + continue */}
          <div className="space-y-md">
            {unassignedFiles.length > 0 && (
              <div className="rounded-md border border-border bg-accent-soft/50 p-md text-sm text-text-secondary">
                {unassignedFiles.length} unassigned photo{unassignedFiles.length !== 1 ? 's' : ''} will not be included. Group them or they&apos;ll be skipped.
              </div>
            )}
            {unassignedFiles.length > 0 && (
              <Button variant="secondary" onClick={autoGroupRemaining} className="w-full">
                Auto-group remaining (each as 1 item)
              </Button>
            )}
            {bulkItems.length > 0 && (
              bulkAnalyzeAllRunning ? (
                <div className="flex items-center justify-center gap-md rounded-md border border-accent bg-accent-soft/50 px-lg py-md">
                  <Spinner size="sm" />
                  <span className="text-sm text-text-secondary">
                    Analyzing {bulkAnalyzeAllProgress?.current || 0} of {bulkAnalyzeAllProgress?.total || bulkItems.length}...
                  </span>
                  <button
                    onClick={() => { bulkAnalyzeAllCancelRef.current = true; }}
                    className="ml-auto text-xs text-danger hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={runAnalyzeAll}
                  className="flex w-full items-center justify-center gap-sm rounded-md border border-accent bg-accent-soft px-lg py-md text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-white"
                >
                  ✨ AI Analyze All ({bulkItems.length} item{bulkItems.length !== 1 ? 's' : ''})
                </button>
              )
            )}
            <Button onClick={proceedToVerify}
              disabled={bulkItems.length === 0 || bulkAnalyzeAllRunning}
              className="w-full">
              Continue with {bulkItems.length} item{bulkItems.length !== 1 ? 's' : ''} →
            </Button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ── Bulk: Per-item Verification ─────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {mode === 'bulk' && bulkStep === 'verify' && currentBulkItem && (
        <div className="space-y-lg">
          <div className="flex items-center justify-between">
            <button onClick={() => {
              if (currentBulkIndex > 0) {
                setCurrentBulkIndex(currentBulkIndex - 1);
                setBulkStep('bulkPrice');
              } else {
                setBulkStep('grouping');
              }
            }} className="text-sm text-text-secondary hover:text-text-primary">
              ← {currentBulkIndex > 0 ? 'Previous' : 'Back to grouping'}
            </button>
            <div className="flex items-center gap-md">
              {/* AI Analyze for bulk item */}
              {currentBulkItem.files.length > 0 && (
                bulkAnalyzing ? (
                  <div className="flex items-center gap-sm rounded-md border border-accent bg-accent-soft/50 px-md py-sm">
                    <Spinner size="sm" />
                    <span className="text-xs text-text-secondary">Analyzing...</span>
                  </div>
                ) : (
                  <button
                    onClick={runBulkAnalysis}
                    className="flex items-center gap-xs rounded-md border border-accent bg-accent-soft px-md py-sm text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-white"
                  >
                    ✨ AI Analyze
                  </button>
                )
              )}
              {bulkItems.length > 1 && (
                <button onClick={() => removeBulkItem(currentBulkIndex)} className="text-xs text-danger hover:underline">
                  Remove this item
                </button>
              )}
            </div>
          </div>

          {/* Photo strip with add/remove */}
          <div className="flex gap-md overflow-x-auto pb-sm">
            {currentBulkItem.previews.map((p, i) => (
              <div key={i} className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-border">
                <img src={p} alt="" className="h-full w-full object-cover" />
                {currentBulkItem.files.length > 1 && (
                  <button
                    onClick={() => removePhotoFromBulkItem(i)}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white shadow-sm"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => bulkPhotoInputRef.current?.click()}
              className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-md border-2 border-dashed border-accent/50 text-xl text-accent hover:border-accent hover:bg-accent-soft"
            >
              +
            </button>
            <input
              ref={bulkPhotoInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => { if (e.target.files) addPhotosToBulkItem(e.target.files); e.target.value = ''; }}
              className="hidden"
            />
          </div>

          {/* Progress dots — hide for single item */}
          {bulkItems.length > 1 && (
            <div className="flex justify-center gap-xs">
              {bulkItems.map((_, i) => (
                <div key={i} className={`h-2 w-2 rounded-full ${
                  i === currentBulkIndex ? 'bg-accent' : i < currentBulkIndex ? 'bg-success' : 'bg-border'
                }`} />
              ))}
            </div>
          )}

          {/* AI applied indicator */}
          {bulkAnalysisApplied[currentBulkItem.id] && (
            <div className="flex items-center justify-between rounded-md border border-success bg-success-soft/50 px-lg py-sm">
              <div className="flex items-center gap-sm">
                <span className="text-success">&#10003;</span>
                <p className="text-xs text-text-secondary">Fields auto-filled by AI</p>
              </div>
              <button onClick={runBulkAnalysis} className="text-xs text-accent hover:underline">Re-analyze</button>
            </div>
          )}

          {/* Item name — editing updates the base title; category fields auto-append */}
          <div>
            <label className="mb-sm block text-xs font-medium uppercase tracking-wide text-text-muted">Item Name</label>
            <input type="text" value={currentBulkItem.title}
              onChange={(e) => {
                setBulkBaseTitles((prev) => ({ ...prev, [currentBulkItem.id]: e.target.value }));
                updateBulkItem(currentBulkIndex, { title: e.target.value });
              }}
              onFocus={() => { bulkTitleFocusedRef.current = true; }}
              onBlur={() => {
                bulkTitleFocusedRef.current = false;
                // Rebuild title with category fields on blur
                const baseTitle = bulkBaseTitles[currentBulkItem.id] || '';
                const built = buildWebItemName(baseTitle, currentBulkItem.category, currentBulkItem.categoryFields);
                if (built.trim()) updateBulkItem(currentBulkIndex, { title: built });
              }}
              placeholder="What is this item?"
              className="w-full rounded-md border border-border bg-card px-md py-md text-md text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none" />
          </div>

          {/* Category dropdown */}
          <div>
            <label className="mb-sm block text-xs font-medium uppercase tracking-wide text-text-muted">Category</label>
            <select
              value={currentBulkItem.category}
              onChange={(e) => updateBulkItem(currentBulkIndex, { category: e.target.value, categoryFields: {} })}
              className="w-full rounded-md border border-border bg-card px-md py-md text-md text-text-primary focus:border-accent focus:outline-none"
            >
              <option value="">Select a category...</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Category-specific fields */}
          {currentDynamicFields.length > 0 && (
            <div className="space-y-md rounded-md border border-border bg-card/50 p-lg">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{currentBulkItem.category} Details</p>
              <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
                {currentDynamicFields.map((field) => (
                  <div key={field.key}>
                    <label className="mb-xs block text-sm text-text-secondary">
                      {field.label}
                    </label>
                    {field.type === 'select' ? (
                      <select value={currentBulkItem.categoryFields[field.key] || ''}
                        onChange={(e) => updateBulkItem(currentBulkIndex, {
                          categoryFields: { ...currentBulkItem.categoryFields, [field.key]: e.target.value },
                        })}
                        className="w-full rounded-md border border-border bg-card px-md py-sm text-sm text-text-primary focus:border-accent focus:outline-none">
                        <option value="">{field.placeholder || 'Select...'}</option>
                        {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type={field.type} value={currentBulkItem.categoryFields[field.key] || ''}
                        onChange={(e) => updateBulkItem(currentBulkIndex, {
                          categoryFields: { ...currentBulkItem.categoryFields, [field.key]: e.target.value },
                        })}
                        placeholder={field.placeholder}
                        className="w-full rounded-md border border-border bg-card px-md py-sm text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Condition */}
          <div>
            <label className="mb-sm block text-xs font-medium uppercase tracking-wide text-text-muted">Condition</label>
            <div className="flex flex-wrap gap-sm">
              {CONDITIONS.map((c) => (
                <button key={c.value} type="button"
                  onClick={() => updateBulkItem(currentBulkIndex, { condition: c.value })}
                  className={`rounded-pill border px-lg py-sm text-sm transition-colors ${
                    currentBulkItem.condition === c.value ? 'border-accent bg-accent text-white' : 'border-border bg-card text-text-primary hover:bg-accent-soft'
                  }`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-sm block text-xs font-medium uppercase tracking-wide text-text-muted">Notes (optional)</label>
            <textarea value={currentBulkItem.notes}
              onChange={(e) => updateBulkItem(currentBulkIndex, { notes: e.target.value })}
              placeholder="Any details buyers should know..."
              rows={2}
              className="w-full resize-none rounded-md border border-border bg-card px-md py-md text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none" />
          </div>

          {/* Browse preview — shows exactly what buyers will see */}
          {(currentBulkItem.title.trim() || currentBulkItem.category || currentBulkItem.previews.length > 0) && (
            <div>
              <label className="mb-sm block text-xs font-medium uppercase tracking-wide text-text-muted">Browse Preview</label>
              <div className="w-48 overflow-hidden rounded-md border border-border bg-card shadow-sm">
                <div className="relative aspect-square bg-accent-soft">
                  {currentBulkItem.previews[0] ? (
                    <img src={currentBulkItem.previews[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl text-text-muted">{'\u{1F4E6}'}</div>
                  )}
                </div>
                <div className="p-md">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {currentBulkItem.title.trim() || 'Untitled Item'}
                  </p>
                  <div className="mt-xs flex flex-wrap gap-xs">
                    {currentBulkItem.category && <Badge variant="neutral">{currentBulkItem.category}</Badge>}
                    {currentBulkItem.condition && (
                      <Badge variant="info">{CONDITIONS.find((c) => c.value === currentBulkItem.condition)?.label || currentBulkItem.condition}</Badge>
                    )}
                  </div>
                  <p className="mt-sm text-xs text-text-muted italic">Price added next step</p>
                </div>
              </div>
            </div>
          )}

          <Button onClick={handleBulkVerifyNext} className="w-full">
            Continue to Pricing
          </Button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ── Bulk: Per-item Pricing ──────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {mode === 'bulk' && bulkStep === 'bulkPrice' && currentBulkItem && (
        <div className="space-y-xl">
          {/* Mini nav with price estimate button */}
          <div className="flex items-center justify-between">
            <button onClick={() => setBulkStep('verify')} className="text-sm text-text-secondary hover:text-text-primary">
              ← Back
            </button>
            <div className="flex items-center gap-md">
              {bulkEstimating ? (
                <div className="flex items-center gap-sm rounded-md border border-accent bg-accent-soft/50 px-md py-sm">
                  <Spinner size="sm" />
                  <span className="text-xs text-text-secondary">Estimating...</span>
                </div>
              ) : (
                <button
                  onClick={handleBulkPriceEstimate}
                  className="flex items-center gap-xs rounded-md border border-accent bg-accent-soft px-md py-sm text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-white"
                >
                  {currentBulkItem.priceEstimate ? '✨ Re-estimate' : '✨ Price Estimate'}
                </button>
              )}
              {bulkItems.length > 1 && (
                <button onClick={() => removeBulkItem(currentBulkIndex)} className="text-xs text-danger hover:underline">
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Progress dots — hide for single item */}
          {bulkItems.length > 1 && (
            <div className="flex justify-center gap-xs">
              {bulkItems.map((_, i) => (
                <div key={i} className={`h-2 w-2 rounded-full ${
                  i <= currentBulkIndex ? 'bg-accent' : 'bg-border'
                }`} />
              ))}
            </div>
          )}

          {/* Compact item card */}
          <div className="flex items-center gap-md rounded-md border border-border bg-card p-md">
            {currentBulkItem.previews[0] && (
              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md">
                <img src={currentBulkItem.previews[0]} alt="" className="h-full w-full object-cover" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">{currentBulkItem.title}</p>
              <div className="mt-xs flex gap-sm">
                <Badge variant="blue">{CONDITIONS.find((c) => c.value === currentBulkItem.condition)?.label}</Badge>
                <Badge variant="neutral">{currentBulkItem.category}</Badge>
              </div>
            </div>
            <button onClick={() => setBulkStep('verify')} className="text-xs text-accent hover:underline">Edit</button>
          </div>

          {/* AI estimate reasoning */}
          {!bulkEstimating && currentBulkItem.priceEstimate && currentBulkItem.priceEstimate.reasoning && (
            <div className="rounded-md border border-border bg-accent-soft/30 p-md">
              <p className="text-xs text-text-muted">{currentBulkItem.priceEstimate.reasoning}</p>
            </div>
          )}

          {/* Price Range — editable inputs */}
          <div>
            <label className="mb-sm block text-xs font-medium uppercase tracking-wide text-text-muted">Price Range</label>
            <div className="flex gap-md">
              <div className="relative flex-1">
                <span className="absolute left-md top-1/2 -translate-y-1/2 text-text-muted">$</span>
                <input type="text" inputMode="numeric" pattern="[0-9]*"
                  value={currentBulkItem.priceEstimate?.market_value_min || ''}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^0-9]/g, '');
                    const val = cleaned ? parseInt(cleaned) : 0;
                    const existing = currentBulkItem.priceEstimate || { market_value_min: 0, market_value_max: 0, confidence: 0, reasoning: '', estimated_midpoint: 0 };
                    updateBulkItem(currentBulkIndex, {
                      priceEstimate: { ...existing, market_value_min: val, estimated_midpoint: Math.round((val + existing.market_value_max) / 2) },
                    });
                  }}
                  placeholder="Min"
                  className="w-full rounded-md border border-border bg-card py-md pl-8 pr-md text-md text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none" />
              </div>
              <span className="flex items-center text-text-muted">–</span>
              <div className="relative flex-1">
                <span className="absolute left-md top-1/2 -translate-y-1/2 text-text-muted">$</span>
                <input type="text" inputMode="numeric" pattern="[0-9]*"
                  value={currentBulkItem.priceEstimate?.market_value_max || ''}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^0-9]/g, '');
                    const val = cleaned ? parseInt(cleaned) : 0;
                    const existing = currentBulkItem.priceEstimate || { market_value_min: 0, market_value_max: 0, confidence: 0, reasoning: '', estimated_midpoint: 0 };
                    updateBulkItem(currentBulkIndex, {
                      priceEstimate: { ...existing, market_value_max: val, estimated_midpoint: Math.round((existing.market_value_min + val) / 2) },
                    });
                  }}
                  placeholder="Max"
                  className="w-full rounded-md border border-border bg-card py-md pl-8 pr-md text-md text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none" />
              </div>
            </div>
          </div>

          {/* Retail Price */}
          <div>
            <label className="mb-sm block text-xs font-medium uppercase tracking-wide text-text-muted">Original Purchase Price</label>
            <div className="relative">
              <span className="absolute left-md top-1/2 -translate-y-1/2 text-text-muted">$</span>
              <input type="text" inputMode="numeric" pattern="[0-9]*" value={currentBulkItem.retailPrice}
                onChange={(e) => updateBulkItem(currentBulkIndex, { retailPrice: e.target.value.replace(/[^0-9]/g, '') })}
                placeholder="What you originally paid"
                className="w-full rounded-md border border-border bg-card py-md pl-8 pr-md text-md text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none" />
            </div>
          </div>

          {/* Min price */}
          <div>
            <label className="mb-sm block text-xs font-medium uppercase tracking-wide text-text-muted">Minimum Price (optional)</label>
            <div className="relative">
              <span className="absolute left-md top-1/2 -translate-y-1/2 text-text-muted">$</span>
              <input type="text" inputMode="numeric" pattern="[0-9]*" value={currentBulkItem.minPrice}
                onChange={(e) => updateBulkItem(currentBulkIndex, { minPrice: e.target.value.replace(/[^0-9]/g, '') })}
                placeholder="Set a floor price"
                className="w-full rounded-md border border-border bg-card py-md pl-8 pr-md text-md text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none" />
            </div>
          </div>

          {/* Next / Review All */}
          <div className="flex gap-md">
            {currentBulkIndex > 0 && (
              <Button variant="secondary" onClick={() => {
                updateBulkItem(currentBulkIndex, { isPriceConfirmed: true });
                setCurrentBulkIndex(currentBulkIndex - 1);
                setBulkStep('verify');
              }} className="flex-1">
                ← Back
              </Button>
            )}
            <Button onClick={handleBulkPriceNext} disabled={bulkEstimating}
              className={currentBulkIndex > 0 ? 'flex-1' : 'w-full'}>
              {currentBulkIndex < bulkItems.length - 1 ? 'Next Item →' : 'Review All →'}
            </Button>
          </div>

          {/* Publish single item */}
          <div className="space-y-xs">
            <Button variant="secondary" onClick={publishSingleBulkItem} disabled={bulkEstimating || bulkPublishing} className="w-full">
              {bulkPublishing ? 'Publishing...' : '\u{1F680} Publish This Item Now'}
            </Button>
            <p className="text-center text-xs text-text-muted">Publish this item individually without waiting for others</p>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ── Bulk: Summary / Review & Add All ───────────────────── */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {mode === 'bulk' && bulkStep === 'summary' && (
        <div className="space-y-xl">
          <button onClick={() => {
            setCurrentBulkIndex(bulkItems.length - 1);
            setBulkStep('bulkPrice');
          }} className="text-sm text-text-secondary hover:text-text-primary">
            ← Back to pricing
          </button>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-md">
            <div className="rounded-md border border-border bg-card p-lg text-center">
              <p className="font-heading text-2xl font-medium text-text-primary">{bulkItems.length}</p>
              <p className="text-xs text-text-muted">item{bulkItems.length !== 1 ? 's' : ''}</p>
            </div>
            {totalEstimatedValue > 0 && (
              <div className="rounded-md border border-border bg-card p-lg text-center">
                <p className="font-heading text-2xl font-medium text-success">${totalEstimatedValue}</p>
                <p className="text-xs text-text-muted">est. total value</p>
              </div>
            )}
          </div>

          {/* Items list */}
          <div>
            <h3 className="mb-md text-sm font-medium text-text-secondary">Your Items</h3>
            <div className="space-y-md">
              {bulkItems.map((item, i) => (
                <div key={item.id} className="flex items-center gap-md rounded-md border border-border bg-card p-md">
                  {item.previews[0] ? (
                    <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-md">
                      <img src={item.previews[0]} alt="" className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-md bg-accent-soft text-3xl">
                      {'\u{1F4E6}'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-sm">
                      <p className="truncate text-sm font-medium text-text-primary">{item.title || 'Untitled'}</p>
                      <Badge variant="neutral">#{i + 1}</Badge>
                    </div>
                    <div className="mt-xs flex flex-wrap items-center gap-sm">
                      <Badge variant="blue">{CONDITIONS.find((c) => c.value === item.condition)?.label}</Badge>
                      <Badge variant="neutral">{item.category || 'No category'}</Badge>
                    </div>
                    <div className="mt-xs flex flex-wrap items-center gap-md">
                      {item.priceEstimate && (
                        <span className="text-xs text-success">
                          ${item.priceEstimate.market_value_min}–${item.priceEstimate.market_value_max}
                        </span>
                      )}
                      {item.minPrice && (
                        <span className="text-xs text-text-muted">min ${item.minPrice}</span>
                      )}
                    </div>
                    {item.files.length > 1 && (
                      <p className="mt-xs text-xs text-text-muted">{item.files.length} photos</p>
                    )}
                  </div>
                  <button onClick={() => {
                    setCurrentBulkIndex(i);
                    setBulkStep('verify');
                  }} className="text-xs text-accent hover:underline">
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleBulkSubmit} disabled={bulkItems.length === 0} className="w-full">
            Add All {bulkItems.length} Item{bulkItems.length !== 1 ? 's' : ''} to My List
          </Button>
        </div>
      )}

      {/* ── Bulk: Submitting ──────────────────────────────────────── */}
      {mode === 'bulk' && bulkStep === 'submitting' && (
        <div className="flex flex-col items-center py-huge">
          <Spinner size="lg" />
          {bulkProgress && (
            <>
              <p className="mt-md text-sm text-text-secondary">
                Publishing {bulkProgress.current} of {bulkProgress.total}...
              </p>
              <div className="mt-md w-full max-w-xs">
                <div className="h-2 overflow-hidden rounded-full bg-accent-soft">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-300"
                    style={{ width: `${Math.round((bulkProgress.current / bulkProgress.total) * 100)}%` }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </PageContainer>
  );
}
