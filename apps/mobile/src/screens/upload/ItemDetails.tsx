import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ListStackParamList } from '../../navigation/types';
import { Text, Button, Input, Card, Header, Pill } from '../../ui/components';
import { colors, spacing, radius, typography } from '../../ui/tokens';
import { useItemsStore, SellIntent, ListingDeliveryPref } from '../../state/itemsStore';
import { useAuthStore } from '../../state/authStore';
import { uploadImage, analyzeImage, getSignedUrl } from '../../services/imageService';

type Props = NativeStackScreenProps<ListStackParamList, 'ItemDetails'>;

type Condition = 'new' | 'like_new' | 'good' | 'fair' | 'poor';

export default function ItemDetailsScreen({ navigation }: Props) {
  const draft = useItemsStore((state) => state.draft);
  const updateDraft = useItemsStore((state) => state.updateDraft);
  const user = useAuthStore((state) => state.user);

  const [title, setTitle] = useState(draft?.title || '');
  const [category, setCategory] = useState(draft?.category || '');
  const [description, setDescription] = useState(draft?.description || '');
  const [condition, setCondition] = useState<Condition>('good');
  const [sellIntent, setSellIntent] = useState<SellIntent>('might_sell');
  const [pricePurchased, setPricePurchased] = useState('');
  const [deliveryPref, setDeliveryPref] = useState<ListingDeliveryPref>('local_only');
  const [notes, setNotes] = useState(draft?.notes || '');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);

  // Auto-analyze image when screen loads
  useEffect(() => {
    async function analyzeItemImage() {
      if (draft?.imageUri && user && !analyzed) {
        setAnalyzing(true);
        try {
          // Upload image to Supabase Storage
          const uploadResult = await uploadImage(draft.imageUri, user.id);
          
          if (!uploadResult.error && uploadResult.path) {
            // Get signed URL for the uploaded image
            const signedUrl = await getSignedUrl(uploadResult.path);
            
            if (signedUrl) {
              // Call analyzeImage Edge Function
              const analysisResult = await analyzeImage(signedUrl, uploadResult.path);
              
              if (analysisResult) {
                // Auto-populate title and category from analysis
                if (analysisResult.label) {
                  // Capitalize the label for display
                  const capitalizedLabel = analysisResult.label.charAt(0).toUpperCase() + analysisResult.label.slice(1);
                  setTitle(capitalizedLabel);
                  setCategory(capitalizedLabel);
                }
                
                // Store the analysis result in draft
                updateDraft({
                  category: analysisResult.label,
                  clarificationResponse: analysisResult.clarification ? {
                    question: analysisResult.clarification.question,
                    options: analysisResult.clarification.options,
                  } : undefined,
                });
              }
            }
          }
        } catch (error) {
          console.warn('Image analysis failed:', error);
          // Non-critical error - user can still enter details manually
        } finally {
          setAnalyzing(false);
          setAnalyzed(true);
        }
      }
    }
    
    analyzeItemImage();
  }, [draft?.imageUri, user, analyzed]);

  const conditionOptions: { value: Condition; label: string }[] = [
    { value: 'new', label: 'New' },
    { value: 'like_new', label: 'Like New' },
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
    { value: 'poor', label: 'Poor' },
  ];

  const sellIntentOptions: { value: SellIntent; label: string }[] = [
    { value: 'keep', label: 'Want to keep' },
    { value: 'might_sell', label: 'Might sell' },
    { value: 'sell', label: 'Ready to sell' },
  ];

  const deliveryOptions: { value: ListingDeliveryPref; label: string }[] = [
    { value: 'local_only', label: 'Local only' },
    { value: 'shipping_ok', label: 'Shipping OK' },
    { value: 'both', label: 'Both' },
  ];

  const handleContinue = () => {
    // Map condition to string format
    const conditionMap: Record<Condition, string> = {
      new: 'New',
      like_new: 'Like new',
      good: 'Good',
      fair: 'Fair',
      poor: 'Poor',
    };

    updateDraft({
      title: title.trim() || 'Untitled Item',
      category: category.trim() || 'General',
      description: description.trim() || undefined,
      condition: conditionMap[condition],
      sellIntent,
      pricePurchased: pricePurchased ? parseFloat(pricePurchased) : undefined,
      deliveryPref,
      notes: notes.trim() || undefined,
    });

    navigation.navigate('PriceReview');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Header title="Item details" showBack={true} />

        {/* Image Preview */}
        {draft?.imageUri && (
          <Card style={styles.imageCard}>
            <Image source={{ uri: draft.imageUri }} style={styles.image} />
            {analyzing && (
              <View style={styles.analyzingOverlay}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text variant="bodyMedium" size="md" color="muted" style={styles.analyzingText}>
                  Analyzing image...
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* Item name */}
        <Input
          label="Item name"
          placeholder={analyzing ? "Analyzing..." : "What is this item?"}
          value={title}
          onChangeText={setTitle}
          editable={!analyzing}
        />

        {/* Category (auto-populated) */}
        <Input
          label="Category"
          placeholder={analyzing ? "Analyzing..." : "e.g. Electronics, Furniture"}
          value={category}
          onChangeText={setCategory}
          editable={!analyzing}
        />

        {/* Description */}
        <View style={styles.inputGroup}>
          <Text variant="body" size="base" color="secondary" style={styles.label}>
            Description
          </Text>
          <TextInput
            style={styles.textArea}
            placeholder="Describe the item (e.g. size, brand, features, condition details)..."
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Condition */}
        <View style={styles.inputGroup}>
          <Text variant="body" size="base" color="secondary" style={styles.label}>
            Condition
          </Text>
          <View style={styles.pills}>
            {conditionOptions.map((option) => (
              <Pill
                key={option.value}
                label={option.label}
                selected={condition === option.value}
                onPress={() => setCondition(option.value)}
              />
            ))}
          </View>
        </View>

        {/* Sell Intent */}
        <View style={styles.inputGroup}>
          <Text variant="body" size="base" color="secondary" style={styles.label}>
            How likely to sell?
          </Text>
          <View style={styles.pills}>
            {sellIntentOptions.map((option) => (
              <Pill
                key={option.value}
                label={option.label}
                selected={sellIntent === option.value}
                onPress={() => setSellIntent(option.value)}
              />
            ))}
          </View>
        </View>

        {/* Price Purchased */}
        <Input
          label="Price purchased (optional)"
          placeholder="$0"
          value={pricePurchased}
          onChangeText={setPricePurchased}
          keyboardType="numeric"
        />

        {/* Delivery Preference */}
        <View style={styles.inputGroup}>
          <Text variant="body" size="base" color="secondary" style={styles.label}>
            Delivery preference
          </Text>
          <View style={styles.pills}>
            {deliveryOptions.map((option) => (
              <Pill
                key={option.value}
                label={option.label}
                selected={deliveryPref === option.value}
                onPress={() => setDeliveryPref(option.value)}
              />
            ))}
          </View>
        </View>

        {/* Additional Notes */}
        <View style={styles.inputGroup}>
          <Text variant="body" size="base" color="secondary" style={styles.label}>
            Additional notes (optional)
          </Text>
          <TextInput
            style={styles.textArea}
            placeholder="Any other details about the item..."
            placeholderTextColor={colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.actions}>
          <Button
            variant="secondary"
            onPress={() => navigation.goBack()}
            style={styles.editBtn}
          >
            ← Edit photo
          </Button>

          <Button
            variant="primary"
            onPress={handleContinue}
            style={styles.continueBtn}
          >
            Continue
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  imageCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.xl,
    position: 'relative',
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.accentSoft,
  },
  analyzingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzingText: {
    marginTop: spacing.md,
    color: '#FFFFFF',
  },
  inputGroup: {
    marginBottom: spacing.xl,
  },
  label: {
    marginBottom: spacing.sm,
  },
  pills: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  textArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    padding: spacing.md,
    fontFamily: typography?.fonts?.body || 'DMSans_400Regular',
    fontSize: typography?.sizes?.md || 14,
    color: colors.textPrimary,
    minHeight: 100,
  },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  editBtn: {},
  continueBtn: {},
});

