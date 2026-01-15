import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { ListStackParamList } from '../../navigation/types';
import { Text, Button, Input, Card, Header, Pill } from '../../ui/components';
import { colors, spacing, radius, typography } from '../../ui/tokens';
import { useItemsStore, SellIntent, ListingDeliveryPref } from '../../state/itemsStore';
import { useAuthStore } from '../../state/authStore';
import { uploadImage, analyzeImage, getSignedUrl } from '../../services/imageService';
import type { AnalyzeImageResponse } from '../../types/analyzeImage';

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
  const [images, setImages] = useState<string[]>(draft?.imageUris || [draft?.imageUri].filter(Boolean) || []);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Auto-analyze image when screen loads
  useEffect(() => {
    console.log('ItemDetails useEffect triggered', {
      hasImageUri: !!draft?.imageUri,
      hasUser: !!user,
      analyzed,
      imageUri: draft?.imageUri,
      userId: user?.id
    });

    async function analyzeItemImage() {
      if (draft?.imageUri && user && !analyzed) {
        setAnalyzing(true);
        try {
          console.log('Starting image analysis for:', draft.imageUri);

          // Upload image to Supabase Storage
          const uploadResult = await uploadImage(draft.imageUri, user.id);
          console.log('Upload result:', uploadResult);

          if (!uploadResult.error && uploadResult.path) {
            // Get signed URL for the uploaded image
            const signedUrl = await getSignedUrl(uploadResult.path);
            console.log('Signed URL:', signedUrl);

            if (signedUrl) {
              // Call analyzeImage Edge Function
              console.log('Calling analyzeImage with:', { signedUrl, path: uploadResult.path });
              const analysisResult = await analyzeImage(signedUrl, uploadResult.path);
              console.log('Analysis result:', analysisResult);

              if (analysisResult) {
                // Auto-populate title and category from analysis
                if (analysisResult.type === 'identified') {
                  console.log('Item identified:', analysisResult.item);
                  setTitle(analysisResult.item.title);
                  setCategory(analysisResult.item.category);
                  if (analysisResult.item.condition) {
                    setCondition(analysisResult.item.condition.toLowerCase() as Condition);
                  }
                  if (analysisResult.item.description) {
                    setDescription(analysisResult.item.description);
                  }
                }

                // Store the analysis result in draft
                updateDraft({
                  clarificationResponse: analysisResult,
                });
              }
            }
          } else {
            console.warn('Upload failed:', uploadResult.error);
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
  }, [draft?.imageUri, user]);

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

  const addMorePhotos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'We need camera roll permissions to upload images.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: Math.max(1, 5 - images.length), // Limit total to 5 photos
    });

    if (!result.canceled && result.assets.length > 0) {
      const newUris = result.assets.map(asset => asset.uri);
      const updatedImages = [...images, ...newUris].slice(0, 5); // Max 5 images
      setImages(updatedImages);
      updateDraft({ imageUris: updatedImages });
    }
  };

  const removePhoto = (index: number) => {
    const updatedImages = images.filter((_, i) => i !== index);
    setImages(updatedImages);
    updateDraft({ imageUris: updatedImages });

    // Adjust current index if needed
    if (currentImageIndex >= updatedImages.length && updatedImages.length > 0) {
      setCurrentImageIndex(updatedImages.length - 1);
    } else if (updatedImages.length === 0) {
      setCurrentImageIndex(0);
    }
  };

  const goToPreviousImage = () => {
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const goToNextImage = () => {
    setCurrentImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

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
        <Header title="Item details" onBack={() => navigation.goBack()} />

        {/* Main Image Preview with Navigation */}
        {images.length > 0 && (
          <Card style={styles.mainImageCard}>
            <Image source={{ uri: images[currentImageIndex] }} style={styles.mainImage} />
            {analyzing && currentImageIndex === 0 && (
              <View style={styles.analyzingOverlay}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text variant="bodyMedium" size="md" color="muted" style={styles.analyzingText}>
                  Analyzing image...
                </Text>
              </View>
            )}

            {/* Navigation Arrows */}
            {images.length > 1 && (
              <>
                <Pressable style={styles.arrowLeft} onPress={goToPreviousImage}>
                  <Text style={styles.arrowText}>‹</Text>
                </Pressable>
                <Pressable style={styles.arrowRight} onPress={goToNextImage}>
                  <Text style={styles.arrowText}>›</Text>
                </Pressable>
              </>
            )}

            {/* Image Counter */}
            {images.length > 1 && (
              <View style={styles.imageCounter}>
                <Text style={styles.imageCounterText}>
                  {currentImageIndex + 1} / {images.length}
                </Text>
              </View>
            )}

            {/* Main Photo Badge */}
            {currentImageIndex === 0 && (
              <View style={styles.mainPhotoBadge}>
                <Text style={styles.mainPhotoBadgeText}>Main Photo</Text>
              </View>
            )}
          </Card>
        )}

        {/* Thumbnail Gallery */}
        <View style={styles.imageGallery}>
          <Text variant="bodyMedium" size="base" color="secondary" style={styles.galleryLabel}>
            Photos ({images.length}/5)
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
            {images.map((uri, index) => (
              <Pressable
                key={index}
                style={styles.imageWrapper}
                onPress={() => setCurrentImageIndex(index)}
              >
                <Image
                  source={{ uri }}
                  style={[
                    styles.thumbnail,
                    currentImageIndex === index && styles.thumbnailActive,
                  ]}
                />
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => removePhoto(index)}
                >
                  <Text style={styles.removeBtnText}>✕</Text>
                </Pressable>
                {index === 0 && (
                  <View style={styles.primaryBadge}>
                    <Text style={styles.primaryBadgeText}>Main</Text>
                  </View>
                )}
              </Pressable>
            ))}
            {images.length < 5 && (
              <Pressable style={styles.addPhotoBtn} onPress={addMorePhotos}>
                <Text style={styles.addPhotoIcon}>+</Text>
                <Text variant="body" size="xs" color="secondary">
                  Add photo
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </View>

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
  mainImageCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    position: 'relative',
  },
  mainImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.accentSoft,
  },
  arrowLeft: {
    position: 'absolute',
    left: 8,
    top: '50%',
    transform: [{ translateY: -24 }],
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowRight: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: [{ translateY: -24 }],
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '300',
    lineHeight: 48,
  },
  imageCounter: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  imageCounterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  mainPhotoBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  mainPhotoBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  imageGallery: {
    marginBottom: spacing.xl,
  },
  galleryLabel: {
    marginBottom: spacing.sm,
  },
  imageScroll: {
    marginHorizontal: -spacing.xxl,
    paddingHorizontal: spacing.xxl,
  },
  imageWrapper: {
    position: 'relative',
    marginRight: spacing.md,
  },
  thumbnail: {
    width: 120,
    height: 120,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailActive: {
    borderColor: colors.accent,
    borderWidth: 3,
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  primaryBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  addPhotoBtn: {
    width: 120,
    height: 120,
    borderRadius: radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addPhotoIcon: {
    fontSize: 32,
    color: colors.textMuted,
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
    borderRadius: radius.md,
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

