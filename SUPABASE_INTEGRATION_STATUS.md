# Supabase Integration Status

## ✅ What's Already Implemented

### 1. Authentication (`authStore.ts`)
- ✅ Supabase auth integration complete
- ✅ Sign in / Sign up / Sign out
- ✅ Session persistence with AsyncStorage
- ✅ Auth state listener
- ✅ Profile creation on signup
- ✅ Guest mode (continue without auth)

### 2. Image Upload (`imageService.ts`)
- ✅ Upload images to `item-images` bucket
- ✅ Get signed URLs for private images
- ✅ Call `analyzeImage` Edge Function
- ✅ Base64 to Blob conversion

### 3. Database Schema (Migrations)
- ✅ `items` table with RLS policies
- ✅ `matches` table for buyer-seller matches
- ✅ `deals` table for negotiations
- ✅ `messages` table for chat
- ✅ `swipe_actions` table for tracking swipes
- ✅ All indexes and triggers in place

### 4. Items Service (`itemsService.ts`)
- ✅ `createItem()` - Insert new items
- ✅ `getMyItems()` - Fetch user's items
- ✅ `getItemById()` - Get single item
- ✅ `updateItem()` - Update item
- ✅ `deleteItem()` - Delete item
- ✅ `getAllItems()` - Browse items (excludes user's own)

---

## 🚧 What's Missing / Needs Connection

### 1. **Upload Flow → Supabase** (HIGH PRIORITY)

#### Current State:
- ✅ Upload screen captures image
- ✅ Sets draft in local store (`itemsStore`)
- ❌ **NOT connected to Supabase**

#### What Needs to Be Done:
1. **In `ItemDetails.tsx` or `PriceReview.tsx`**: Call `uploadImage()` from `imageService`
2. **Get AI analysis**: Call `analyzeImage()` Edge Function
3. **Create item in DB**: Call `createItem()` from `itemsService` with:
   - `title` (from AI or user input)
   - `category` (from AI or user input)
   - `condition` (user selected)
   - `photos` (array with uploaded image path)
   - `delivery_pref` (user selected: local_only, shipping_ok, both)
   - `asking_price` (optional, from user)
4. **Clear draft** and navigate back to MyList

#### Files to Modify:
- `apps/mobile/src/screens/upload/ItemDetails.tsx`
- `apps/mobile/src/screens/upload/PriceReview.tsx`

#### Example Flow:
```typescript
// In PriceReview.tsx when user taps "Add to List"
const handleAddToList = async () => {
  const user = useAuthStore.getState().user;
  if (!user) return;

  // 1. Upload image
  const { path, error: uploadError } = await uploadImage(draft.imageUri, user.id);
  if (uploadError) { /* handle error */ }

  // 2. (Optional) Analyze image
  const signedUrl = await getSignedUrl(path);
  const analysis = await analyzeImage(signedUrl, path);

  // 3. Create item in Supabase
  const { data, error } = await createItem({
    title: draft.title || analysis?.label || 'Untitled',
    category: draft.category || analysis?.category || 'Other',
    condition: draft.condition || 'good',
    photos: [path],
    delivery_pref: draft.deliveryPref || 'either',
    asking_price: draft.minimumPrice ? draft.minimumPrice * 100 : undefined,
  });

  // 4. Clear draft and go back
  clearDraft();
  navigation.navigate('MyList');
};
```

---

### 2. **MyList → Display Supabase Items** (HIGH PRIORITY)

#### Current State:
- ✅ Fetches items from Supabase (`getMyItems()`)
- ✅ Stores in `supabaseItems` state
- ❌ **Only shows demo/local items, not Supabase items**

#### What Needs to Be Done:
1. **Merge Supabase items with demo items** in the render
2. **Map Supabase schema to display format**:
   ```typescript
   const supabaseItemsFormatted = supabaseItems.map(item => ({
     id: item.id,
     emoji: '📦', // or derive from category
     title: item.title,
     category: item.category,
     sellIntent: item.condition,
     imageUri: item.photos?.[0], // need to get signed URL
     isSupabase: true,
   }));
   ```
3. **Load signed URLs for images** before rendering
4. **Combine with demo items**: `const allItems = [...supabaseItemsFormatted, ...demoItems]`

#### Files to Modify:
- `apps/mobile/src/screens/home/MyList.tsx` (lines 89-150)

---

### 3. **Wants → Supabase Integration** (MEDIUM PRIORITY)

#### Current State:
- ❌ Wants stored in **AsyncStorage** only (`wantsService.ts`)
- ❌ No Supabase table for wants

#### What Needs to Be Done:
1. **Create `wants` table migration**:
   ```sql
   CREATE TABLE wants (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     query TEXT NOT NULL,
     max_price NUMERIC,
     urgency TEXT DEFAULT 'casual', -- casual, interested, urgent
     delivery_pref TEXT DEFAULT 'local_only', -- local_only, shipping_ok
     created_at TIMESTAMPTZ DEFAULT now(),
     updated_at TIMESTAMPTZ DEFAULT now()
   );
   ```
2. **Create `supabaseWantsService.ts`** (or update existing service)
3. **Update `MyWants.tsx`** to use Supabase service instead of AsyncStorage

#### Files to Create/Modify:
- `supabase/migrations/20260113000000_create_wants_table.sql` (NEW)
- `apps/mobile/src/services/supabaseWantsService.ts` (EXISTS, needs implementation)
- `apps/mobile/src/screens/wants/MyWants.tsx`

---

### 4. **Swipe → Real Data from Supabase** (MEDIUM PRIORITY)

#### Current State:
- ✅ Swipe UI fully implemented
- ❌ Uses **hardcoded demo data** (`buyingCards`, `sellingCards`)
- ❌ Swipe actions not saved to DB

#### What Needs to Be Done:

**For "Buying" Mode:**
1. Call `getAllItems()` to fetch items (excludes user's own)
2. Filter by user's wants or show all
3. Calculate market comparison (requires market value data)
4. On swipe: Save to `swipe_actions` table
5. On "good deal" swipe: Create match in `matches` table

**For "Selling" Mode:**
1. Fetch incoming matches from `matches` table where `seller_id = user.id`
2. Show items that buyers are interested in
3. Display buyer's max offer (if available)
4. On accept: Create deal in `deals` table

#### Files to Modify:
- `apps/mobile/src/screens/swipe/SwipeMain.tsx`
- Create: `apps/mobile/src/services/swipeService.ts`
- Create: `apps/mobile/src/services/matchService.ts`

#### Example Services Needed:
```typescript
// swipeService.ts
export async function saveSwipeAction(
  itemId: string,
  action: 'good_deal' | 'skip' | 'save',
  context: 'buy' | 'sell'
): Promise<void> { /* ... */ }

// matchService.ts
export async function createMatch(
  buyerId: string,
  sellerId: string,
  itemId: string,
  matchScore: number
): Promise<Match> { /* ... */ }

export async function getMyMatches(
  type: 'buying' | 'selling'
): Promise<Match[]> { /* ... */ }
```

---

## 📋 Priority Implementation Order

### Phase 1: Core Upload & Display (2-3 hours)
1. ✅ **Upload flow** → Supabase (ItemDetails/PriceReview → imageService → itemsService)
2. ✅ **MyList display** → Show Supabase items with signed URLs
3. ✅ **Test end-to-end**: Upload photo → See in MyList

### Phase 2: Wants Integration (1-2 hours)
1. ✅ Create `wants` table migration
2. ✅ Implement Supabase wants service
3. ✅ Update MyWants screen to use Supabase
4. ✅ Test: Add want → See in list → Edit → Delete

### Phase 3: Swipe Real Data (3-4 hours)
1. ✅ Implement swipe services (save actions, create matches)
2. ✅ Update SwipeMain to fetch real items
3. ✅ Calculate market comparisons (basic version)
4. ✅ Test: Swipe → Create match → See in Deals

### Phase 4: Polish & Edge Cases (2-3 hours)
1. ✅ Loading states and error handling
2. ✅ Image caching/optimization
3. ✅ Pull-to-refresh for all lists
4. ✅ Empty states when no data

---

## 🔧 Quick Start: Connect Upload Flow

Here's the fastest path to get items flowing through Supabase:

### Step 1: Update `PriceReview.tsx`
```typescript
import { uploadImage, getSignedUrl, analyzeImage } from '../../services/imageService';
import { createItem } from '../../services/itemsService';

// In handleAddToList function:
const handleAddToList = async () => {
  const user = useAuthStore.getState().user;
  if (!user) {
    Alert.alert('Error', 'Please log in to add items');
    return;
  }

  setSubmitting(true);

  try {
    // 1. Upload image
    const { path, error: uploadError } = await uploadImage(draft.imageUri, user.id);
    if (uploadError) throw new Error(uploadError);

    // 2. Create item
    const { data, error } = await createItem({
      title: draft.title || 'Untitled Item',
      category: draft.category || 'Other',
      condition: draft.sellIntent || 'good',
      photos: [path],
      delivery_pref: draft.deliveryPref || 'both',
      asking_price: draft.minimumPrice ? Math.round(draft.minimumPrice * 100) : undefined,
    });

    if (error) throw new Error(error);

    // 3. Success!
    clearDraft();
    navigation.navigate('MyList');
  } catch (err) {
    Alert.alert('Error', err.message);
  } finally {
    setSubmitting(false);
  }
};
```

### Step 2: Update `MyList.tsx` to Show Images
```typescript
// Add function to load signed URLs
const [itemsWithUrls, setItemsWithUrls] = useState([]);

useEffect(() => {
  async function loadImagesForItems() {
    const itemsWithSignedUrls = await Promise.all(
      supabaseItems.map(async (item) => {
        const imageUrl = item.photos?.[0]
          ? await getSignedUrl(item.photos[0])
          : null;
        return {
          ...item,
          imageUrl,
        };
      })
    );
    setItemsWithUrls(itemsWithSignedUrls);
  }

  if (supabaseItems.length > 0) {
    loadImagesForItems();
  }
}, [supabaseItems]);

// Then render itemsWithUrls instead of supabaseItems
```

---

## 📝 Notes

- **Auth is already working** - all services correctly check for authenticated user
- **Database schema is complete** - all tables exist and have proper RLS
- **Image upload works** - just needs to be called from UI
- **Main gap is connecting UI flows to existing services**

The infrastructure is 80% done - we just need to wire up the UI components to call the Supabase services!
