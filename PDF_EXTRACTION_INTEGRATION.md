# PDF Extraction - Integration Quick Start

Quick reference for integrating PDF extraction into your upload flow.

## 1. Add PDF File Picker to Upload Screen

Update `apps/mobile/src/screens/upload/ItemDetails.tsx`:

```typescript
import * as DocumentPicker from 'expo-document-picker';
import { uploadAndExtractPDF } from '@/services/pdfService';
import { ExtractedItemOutput } from '@/types/pdfExtraction';

// In your component:
export function ItemDetails() {
  const [extractedItems, setExtractedItems] = useState<ExtractedItemOutput[]>([]);
  const [isExtractingPDF, setIsExtractingPDF] = useState(false);

  const handlePDFPicker = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
      });

      if (result.type === 'success') {
        setIsExtractingPDF(true);

        const { items, error } = await uploadAndExtractPDF(result.uri);

        if (error) {
          Alert.alert('Extraction Error', error);
        } else {
          setExtractedItems(items);
          // Show review/edit screen
          navigateToReviewExtractedItems(items);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select PDF');
    } finally {
      setIsExtractingPDF(false);
    }
  };

  return (
    <View>
      {/* Existing image upload button */}
      <Button onPress={() => {...}} title="Take/Upload Photo" />

      {/* Add PDF option */}
      <Button
        onPress={handlePDFPicker}
        disabled={isExtractingPDF}
        title={isExtractingPDF ? 'Extracting...' : 'Upload Senior Sale PDF'}
      />

      {/* Show extracted items count */}
      {extractedItems.length > 0 && (
        <Text style={{ color: 'green' }}>
          ✓ Extracted {extractedItems.length} items
        </Text>
      )}
    </View>
  );
}
```

## 2. Create Review/Edit Screen

Create `apps/mobile/src/screens/upload/ReviewExtractedItems.tsx`:

```typescript
import React, { useState } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { ExtractedItemOutput } from '@/types/pdfExtraction';
import { useItemStore } from '@/state/itemStore';

export function ReviewExtractedItems({ route, navigation }: any) {
  const { items } = route.params as { items: ExtractedItemOutput[] };
  const [editedItems, setEditedItems] = useState<ExtractedItemOutput[]>(items);
  const createItems = useItemStore(state => state.createItems);

  const handleCreateAll = async () => {
    try {
      // Convert to full Item format and create
      await createItems(editedItems.map(item => ({
        ...item,
        id: generateId(),
        owner_id: user.id,
        phase: 'active' as const,
        intent: 'owned' as const,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })));

      Alert.alert('Success', `Created ${editedItems.length} items`);
      navigation.navigate('Home');
    } catch (error) {
      Alert.alert('Error', 'Failed to create items');
    }
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...editedItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setEditedItems(newItems);
  };

  const deleteItem = (index: number) => {
    setEditedItems(editedItems.filter((_, i) => i !== index));
  };

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
        Review {editedItems.length} Extracted Items
      </Text>

      {editedItems.map((item, index) => (
        <View
          key={index}
          style={{
            borderWidth: 1,
            borderColor: '#ddd',
            padding: 12,
            marginBottom: 12,
            borderRadius: 8,
          }}
        >
          {/* Edit title */}
          <TextInput
            value={item.title}
            onChangeText={(text) => updateItem(index, 'title', text)}
            placeholder="Item title"
            style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}
          />

          {/* Edit description */}
          <TextInput
            value={item.description}
            onChangeText={(text) => updateItem(index, 'description', text)}
            placeholder="Description"
            multiline
            numberOfLines={3}
            style={{ borderWidth: 1, borderColor: '#ddd', padding: 8, marginBottom: 8 }}
          />

          {/* Edit price */}
          <View style={{ flexDirection: 'row', marginBottom: 8 }}>
            <TextInput
              value={String(item.user_min_price || '')}
              onChangeText={(text) => updateItem(index, 'user_min_price', parseFloat(text))}
              placeholder="Min price"
              keyboardType="decimal-pad"
              style={{ flex: 1, borderWidth: 1, borderColor: '#ddd', padding: 8, marginRight: 8 }}
            />
            <TextInput
              value={String(item.user_max_price || '')}
              onChangeText={(text) => updateItem(index, 'user_max_price', parseFloat(text))}
              placeholder="Max price"
              keyboardType="decimal-pad"
              style={{ flex: 1, borderWidth: 1, borderColor: '#ddd', padding: 8 }}
            />
          </View>

          {/* Edit category */}
          <TextInput
            value={item.category}
            onChangeText={(text) => updateItem(index, 'category', text)}
            placeholder="Category"
            style={{ borderWidth: 1, borderColor: '#ddd', padding: 8, marginBottom: 8 }}
          />

          {/* Edit condition */}
          <TextInput
            value={item.condition || ''}
            onChangeText={(text) => updateItem(index, 'condition', text)}
            placeholder="Condition (new/like_new/good/fair/poor)"
            style={{ borderWidth: 1, borderColor: '#ddd', padding: 8, marginBottom: 8 }}
          />

          {/* Mark as sold */}
          <TouchableOpacity
            onPress={() => updateItem(index, 'isSold', !item.isSold)}
            style={{
              padding: 8,
              backgroundColor: item.isSold ? '#ffcccc' : '#fff',
              borderWidth: 1,
              borderColor: item.isSold ? '#ff0000' : '#ddd',
              borderRadius: 4,
              marginBottom: 8,
            }}
          >
            <Text>{item.isSold ? '✓ Marked as Sold' : 'Not Sold'}</Text>
          </TouchableOpacity>

          {/* Delete button */}
          <TouchableOpacity
            onPress={() => deleteItem(index)}
            style={{ padding: 8, backgroundColor: '#f0f0f0', borderRadius: 4 }}
          >
            <Text style={{ color: '#ff0000' }}>Delete Item</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Create all items button */}
      <TouchableOpacity
        onPress={handleCreateAll}
        style={{
          padding: 16,
          backgroundColor: '#007AFF',
          borderRadius: 8,
          marginTop: 16,
          marginBottom: 32,
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center', fontSize: 16, fontWeight: 'bold' }}>
          Create All {editedItems.length} Items
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
```

## 3. Add Navigation Route

Update your navigation configuration:

```typescript
// In your navigation stack
<Stack.Screen
  name="ReviewExtractedItems"
  component={ReviewExtractedItems}
  options={{ title: 'Review Extracted Items' }}
/>
```

## 4. Update Item Service

Ensure your item service can handle batch creation:

```typescript
// In itemsService.ts
export async function createBulkItems(items: Item[]): Promise<void> {
  const { error } = await supabase
    .from('items')
    .insert(items);

  if (error) {
    throw new Error(`Failed to create items: ${error.message}`);
  }
}
```

## 5. Install Required Dependencies

Add the document picker to your project:

```bash
npx expo install expo-document-picker
```

## Example Flow

```
User Interface Flow:
│
├─ ItemDetails Screen
│  ├─ "Upload Senior Sale PDF" button
│  └─ Click → DocumentPicker opens
│
├─ PDF Selected
│  ├─ uploadAndExtractPDF(uri) called
│  ├─ Shows loading indicator
│  └─ Returns ExtractedItemOutput[]
│
├─ ReviewExtractedItems Screen
│  ├─ Shows all extracted items
│  ├─ User can edit each item
│  ├─ User can delete items
│  └─ Click "Create All Items"
│
└─ Items Created
   ├─ Items added to database
   ├─ Show success message
   └─ Navigate to Home
```

## Data Flow

```typescript
// 1. PDF selected and uploaded
uploadPDF(uri, userId)
→ PDF uploaded to Supabase Storage (item-pdfs bucket)

// 2. Extract items from PDF
extractItemsFromPDF(pdfPath, userId)
→ Edge function processes PDF
→ Claude parses content
→ Images uploaded to Supabase Storage (item-images bucket)

// 3. Returns extracted items
ExtractedItemOutput[] with:
  - title, category, description
  - photos (uploaded paths)
  - user_min_price, user_max_price
  - condition, isSold

// 4. User reviews and edits
ReviewExtractedItems component
→ Display extracted items
→ Allow editing of any field
→ Allow deletion of items

// 5. Create items
createBulkItems(editedItems)
→ Items inserted to database
→ Available in app immediately
```

## Type Safety

All functions are fully typed:

```typescript
// Request types
PDFExtractionRequest: { pdfPath, userId, options }

// Response types
PDFExtractionResponse: { success, items, errors, metadata }

// Extracted items
ExtractedItemOutput: {
  title: string;
  category: string;
  description: string;
  photos: string[];
  user_min_price?: number;
  user_max_price?: number;
  condition?: ItemCondition;
  isSold?: boolean;
  confidence?: number;
}

// Full item (for creation)
Item: { ...ExtractedItemOutput, id, owner_id, phase, intent, ... }
```

## Error Handling

```typescript
const { items, error } = await uploadAndExtractPDF(uri);

if (error) {
  // Handle errors
  switch (error) {
    case 'User not authenticated':
      // Redirect to login
      break;
    case 'Failed to download PDF':
      // Retry upload
      break;
    case 'Extraction failed':
      // Show detailed error
      break;
    default:
      // Unknown error
  }
}
```

## Testing Checklist

- [ ] PDF bucket created (`item-pdfs`)
- [ ] Edge function deployed (`extractPDF`)
- [ ] Mobile app can select PDF
- [ ] PDF uploads successfully
- [ ] Edge function receives PDF
- [ ] Claude parses content correctly
- [ ] Items extracted with correct format
- [ ] Images uploaded to storage
- [ ] Review screen displays items
- [ ] User can edit items
- [ ] Items create in database
- [ ] Items visible in app

## Performance Tips

1. **Show Progress**: Indicate extraction is happening
2. **Batch Operations**: Extract all items at once
3. **Image Optimization**: Resize images during upload
4. **Error Recovery**: Allow retry if extraction fails
5. **Caching**: Cache extracted items during review

## Next Steps

1. Install `expo-document-picker`
2. Add PDF button to upload screen
3. Create review component
4. Test with `sample_senior_sale.pdf`
5. Deploy to production
