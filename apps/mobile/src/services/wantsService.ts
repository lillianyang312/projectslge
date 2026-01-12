/**
 * Wants Service - Manages user wants/wishlist
 * Uses AsyncStorage for persistence (can be swapped to Supabase later)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type WantUrgency = 'casual' | 'interested' | 'urgent';
export type WantDeliveryPref = 'local_only' | 'shipping_ok';

export interface Want {
  id: string;
  query: string;
  max_price?: number;
  urgency: WantUrgency;
  delivery_pref: WantDeliveryPref;
  created_at: string;
  updated_at: string;
}

const WANTS_STORAGE_KEY = '@passive_shopping:wants';

/**
 * Get all wants for current user
 */
export async function getWants(): Promise<Want[]> {
  try {
    const jsonValue = await AsyncStorage.getItem(WANTS_STORAGE_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (error) {
    console.error('Error loading wants:', error);
    return [];
  }
}

/**
 * Get a single want by ID
 */
export async function getWantById(id: string): Promise<Want | null> {
  const wants = await getWants();
  return wants.find(w => w.id === id) || null;
}

/**
 * Create a new want
 */
export async function createWant(
  data: Omit<Want, 'id' | 'created_at' | 'updated_at'>
): Promise<Want> {
  const wants = await getWants();
  const newWant: Want = {
    ...data,
    id: Date.now().toString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  wants.push(newWant);
  await AsyncStorage.setItem(WANTS_STORAGE_KEY, JSON.stringify(wants));
  return newWant;
}

/**
 * Update an existing want
 */
export async function updateWant(
  id: string,
  data: Partial<Omit<Want, 'id' | 'created_at' | 'updated_at'>>
): Promise<Want | null> {
  const wants = await getWants();
  const index = wants.findIndex(w => w.id === id);

  if (index === -1) return null;

  wants[index] = {
    ...wants[index],
    ...data,
    updated_at: new Date().toISOString(),
  };

  await AsyncStorage.setItem(WANTS_STORAGE_KEY, JSON.stringify(wants));
  return wants[index];
}

/**
 * Delete a want
 */
export async function deleteWant(id: string): Promise<boolean> {
  const wants = await getWants();
  const filtered = wants.filter(w => w.id !== id);

  if (filtered.length === wants.length) return false;

  await AsyncStorage.setItem(WANTS_STORAGE_KEY, JSON.stringify(filtered));
  return true;
}
