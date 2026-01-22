import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  findNodeHandle,
  ActionSheetIOS,
  Modal,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { ListStackParamList } from '../../navigation/types';
import { Text, Button, Card, Header, Badge } from '../../ui/components';
import { colors, spacing, radius, typography } from '../../ui/tokens';
import { useItemsStore } from '../../state/itemsStore';
import { useAuthStore } from '../../state/authStore';
import { uploadImageGroup, analyzeImages, getSignedUrlCached } from '../../services/imageService';
import type { AnalyzeImageResponse } from '../../types/analyzeImage';
import { isNeedsClarificationResponse } from '../../schemas/clarification_schema';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type Props = NativeStackScreenProps<ListStackParamList, 'ItemDetails'>;

type Condition = 'new' | 'like_new' | 'good' | 'fair' | 'poor';

export default function ItemDetailsScreen({ navigation }: Props) {
  const draft = useItemsStore((state) => state.draft);
  const updateDraft = useItemsStore((state) => state.updateDraft);
  const user = useAuthStore((state) => state.user);

  // Simplified form state: title, category, condition, notes
  const [title, setTitle] = useState(draft?.title || '');
  const [category, setCategory] = useState(draft?.category || '');
  const [condition, setCondition] = useState<Condition>('good');
  const [notes, setNotes] = useState(draft?.notes || '');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [images, setImages] = useState<string[]>(draft?.imageUris || [draft?.imageUri].filter(Boolean) || []);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [showFullscreenPhoto, setShowFullscreenPhoto] = useState(false);
  const [fullscreenImageUri, setFullscreenImageUri] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const notesInputRef = useRef<TextInput>(null);

  // Track keyboard visibility for extra padding
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );
    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  // Helper to scroll input into view when focused
  const scrollToInput = (inputRef: React.RefObject<TextInput>) => {
    if (inputRef.current && scrollViewRef.current) {
      const nodeHandle = findNodeHandle(inputRef.current);
      if (nodeHandle) {
        setTimeout(() => {
          scrollViewRef.current?.scrollResponderScrollNativeHandleToKeyboard(
            nodeHandle,
            120, // margin above keyboard
            true
          );
        }, 100);
      }
    }
  };

  // Auto-analyze images when screen loads
  useEffect(() => {
    const imagesToAnalyze = images.length > 0 ? images : (draft?.imageUri ? [draft.imageUri] : []);

    console.log('ItemDetails useEffect triggered', {
      imageCount: imagesToAnalyze.length,
      hasUser: !!user,
      analyzed,
      userId: user?.id
    });

    async function analyzeItemImages() {
      if (imagesToAnalyze.length > 0 && user && !analyzed) {
        setAnalyzing(true);
        try {
          console.log(`Starting image analysis for ${imagesToAnalyze.length} image(s)`);

          // Upload all images as a group to Supabase Storage
          const { paths, groupId, errors } = await uploadImageGroup(imagesToAnalyze, user.id);

          if (errors.length > 0) {
            console.warn('[ItemDetails] Some images failed to upload:', errors);
          }

          console.log(`[ItemDetails] Uploaded ${paths.length} images with groupId: ${groupId}`);

          if (paths.length > 0) {
            // Get signed URLs for all uploaded images (using cached signing)
            const signedUrlPromises = paths.map(path => getSignedUrlCached(path));
            const signedUrls = await Promise.all(signedUrlPromises);

            // Filter out null URLs
            const validSignedUrls = signedUrls.filter((url): url is string => url !== null);
            const validPaths = paths.filter((_, i) => signedUrls[i] !== null);

            console.log(`Got ${validSignedUrls.length} signed URLs for analysis`);

            if (validSignedUrls.length > 0) {
              // Call analyzeImages Edge Function with all images
              console.log('Calling analyzeImages with:', {
                urlCount: validSignedUrls.length,
                pathCount: validPaths.length
              });
              const analysisResult = await analyzeImages(validSignedUrls, validPaths);
              console.log('Analysis result:', analysisResult);

              if (analysisResult) {
                // Auto-populate title and category from analysis
                if (analysisResult.type === 'identified') {
                  console.log('Item identified:', analysisResult.item);
                  setTitle(analysisResult.item.title);
                  setCategory(analysisResult.item.category);
                  if (analysisResult.item.condition) {
                    const conditionLower = analysisResult.item.condition.toLowerCase().replace(' ', '_') as Condition;
                    if (['new', 'like_new', 'good', 'fair', 'poor'].includes(conditionLower)) {
                      setCondition(conditionLower);
                    }
                  }
                }

                // Store the analysis result in draft
                updateDraft({
                  clarificationResponse: analysisResult,
                });
              }
            }
          } else {
            console.warn('All uploads failed');
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

    analyzeItemImages();
  }, [images, draft?.imageUri, user]);

  const conditionOptions: { value: Condition; label: string }[] = [
    { value: 'new', label: 'New' },
    { value: 'like_new', label: 'Like New' },
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
    { value: 'poor', label: 'Poor' },
  ];

  const takePhotoWithCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'We need camera permissions to take photos.'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const newUri = result.assets[0].uri;
      const updatedImages = [...images, newUri].slice(0, 5); // Max 5 images
      setImages(updatedImages);
      updateDraft({ imageUris: updatedImages });
      // Trigger re-analysis when new photo is added
      setAnalyzed(false);
    }
  };

  const pickFromGallery = async () => {
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
      // Trigger re-analysis when new photos are added
      setAnalyzed(false);
    }
  };

  const addMorePhotos = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            takePhotoWithCamera();
          } else if (buttonIndex === 2) {
            pickFromGallery();
          }
        }
      );
    } else {
      // For Android, show an Alert with options
      Alert.alert(
        'Add Photo',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: takePhotoWithCamera },
          { text: 'Choose from Library', onPress: pickFromGallery },
        ]
      );
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

  const openFullscreenPhoto = (uri: string) => {
    setFullscreenImageUri(uri);
    setShowFullscreenPhoto(true);
  };

  const handleClarificationOptionSelect = (optionLabel: string) => {
    // When user selects a clarification option, update the category
    // The option label is typically the category name
    setCategory(optionLabel);
    
    // Clear the clarification response since user has made a selection
    updateDraft({
      clarificationResponse: undefined,
    });
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
      condition: conditionMap[condition],
      notes: notes.trim() || undefined,
    });

    navigation.navigate('PriceReview');
  };

  // Scroll to notes input when focused
  const scrollToNotesInput = () => {
    if (notesInputRef.current && scrollViewRef.current) {
      setTimeout(() => {
        (notesInputRef.current as any)?.measure?.(
          (_x: number, _y: number, _width: number, _height: number, _pageX: number, pageY: number) => {
            scrollViewRef.current?.scrollTo({ y: Math.max(0, pageY - 200), animated: true });
          }
        );
      }, 150);
    }
  };

  // Clearable Input component
  const ClearableInput = ({
    label,
    value,
    onChangeText,
    placeholder,
    multiline = false,
    keyboardType = 'default',
    inputRef,
    onFocus,
  }: {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder: string;
    multiline?: boolean;
    keyboardType?: 'default' | 'numeric';
    inputRef?: React.RefObject<TextInput>;
    onFocus?: () => void;
  }) => (
    <View style={styles.inputGroup}>
      <Text variant="body" size="sm" color="muted" style={styles.label}>
        {label}
      </Text>
      <View style={styles.inputWrapper}>
        <TextInput
          ref={inputRef}
          style={[styles.clearableInput, multiline && styles.multilineInput]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          multiline={multiline}
          keyboardType={keyboardType}
          onFocus={onFocus}
        />
        {value.length > 0 && (
          <Pressable style={styles.clearButton} onPress={() => onChangeText('')}>
            <Text style={styles.clearButtonText}>✕</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/* Fullscreen Photo Modal */}
      <Modal
        visible={showFullscreenPhoto}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFullscreenPhoto(false)}
        statusBarTranslucent
      >
        <StatusBar backgroundColor="rgba(0,0,0,0.95)" barStyle="light-content" />
        <View style={styles.fullscreenModal}>
          <Pressable
            style={styles.fullscreenCloseArea}
            onPress={() => setShowFullscreenPhoto(false)}
          >
            <Image
              source={{ uri: fullscreenImageUri || '' }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          </Pressable>
          <Pressable
            style={styles.fullscreenCloseButton}
            onPress={() => setShowFullscreenPhoto(false)}
          >
            <Text style={styles.fullscreenCloseText}>✕</Text>
          </Pressable>
        </View>
      </Modal>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            isKeyboardVisible && { paddingBottom: 150 },
          ]}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={true}
        >
          <Header title="Item details" onBack={() => navigation.goBack()} />

        {/* Compact Photo Thumbnails - Tap to expand */}
        <View style={styles.imageGallery}>
          <View style={styles.galleryHeader}>
            <Text variant="body" size="sm" color="muted">
              Photos ({images.length}/5)
            </Text>
            {analyzing && (
              <View style={styles.analyzingBadge}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text variant="body" size="xs" color="accent">Analyzing...</Text>
              </View>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
            {images.map((uri, index) => (
              <View key={index} style={styles.imageWrapper}>
                <Pressable onPress={() => openFullscreenPhoto(uri)}>
                  <Image source={{ uri }} style={styles.thumbnail} />
                </Pressable>
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => removePhoto(index)}
                >
                  <Text style={styles.removeBtnText}>✕</Text>
                </Pressable>
              </View>
            ))}
            {images.length < 5 && (
              <Pressable style={styles.addPhotoBtn} onPress={addMorePhotos}>
                <Text style={styles.addPhotoIcon}>+</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>

        {/* Clarification Section - Show when needs_clarification */}
        {draft?.clarificationResponse && isNeedsClarificationResponse(draft.clarificationResponse) && (
          <Card style={styles.clarificationCard}>
            <View style={styles.clarificationHeader}>
              <Text variant="bodyMedium" size="md" style={styles.clarificationTitle}>
                {draft.clarificationResponse.question}
              </Text>
              <Badge 
                variant="neutral" 
                text={`${Math.round(draft.clarificationResponse.confidence * 100)}% confidence`}
              />
            </View>
            
            {draft.clarificationResponse.options.length > 0 ? (
              <View style={styles.clarificationOptions}>
                {draft.clarificationResponse.options.map((option) => (
                  <Pressable
                    key={option.id}
                    style={styles.clarificationOption}
                    onPress={() => handleClarificationOptionSelect(option.label)}
                  >
                    <Text variant="bodyMedium" size="base" style={styles.optionLabel}>
                      {option.label}
                    </Text>
                    <Text variant="body" size="sm" color="muted" style={styles.optionDescriptor}>
                      {option.descriptor}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text variant="body" size="sm" color="muted" style={styles.noOptionsText}>
                Please enter the item details manually below.
              </Text>
            )}
          </Card>
        )}

        {/* Item name */}
        <ClearableInput
          label="Item name"
          placeholder={analyzing ? "Analyzing..." : "What is this item?"}
          value={title}
          onChangeText={setTitle}
        />

        {/* Category */}
        <ClearableInput
          label="Category"
          placeholder={analyzing ? "Analyzing..." : "e.g. Electronics, Furniture"}
          value={category}
          onChangeText={setCategory}
        />

        {/* Condition - inline pills with horizontal scroll for title */}
        <View style={styles.inputGroup}>
          <Text variant="body" size="sm" color="muted" style={styles.label}>
            Condition
          </Text>
          <View style={styles.conditionRow}>
            {conditionOptions.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.conditionPill,
                  condition === option.value && styles.conditionPillSelected,
                ]}
                onPress={() => setCondition(option.value)}
              >
                <Text
                  style={[
                    styles.conditionPillText,
                    condition === option.value && styles.conditionPillTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Additional Notes */}
        <ClearableInput
          label="Additional notes (optional)"
          placeholder="Any other details buyers should know..."
          value={notes}
          onChangeText={setNotes}
          multiline
          inputRef={notesInputRef}
          onFocus={scrollToNotesInput}
        />

        <View style={styles.actions}>
          <Button
            variant="primary"
            onPress={handleContinue}
            style={styles.continueBtn}
          >
            Continue
          </Button>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  // Fullscreen photo modal
  fullscreenModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenCloseArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
  fullscreenCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenCloseText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '300',
  },
  // Image gallery (compact)
  imageGallery: {
    marginBottom: spacing.md,
  },
  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  analyzingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  imageScroll: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  imageWrapper: {
    position: 'relative',
    marginRight: spacing.md,
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailActive: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  removeBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  primaryBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    backgroundColor: colors.accent,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  primaryBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '600',
  },
  addPhotoBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoIcon: {
    fontSize: 18,
    color: colors.textMuted,
  },
  // Clearable input styles
  inputGroup: {
    marginBottom: spacing.sm,
  },
  label: {
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    position: 'relative',
  },
  clearableInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingRight: 40,
    fontFamily: typography?.fonts?.body || 'DMSans_400Regular',
    fontSize: typography?.sizes?.md || 14,
    color: colors.textPrimary,
  },
  multilineInput: {
    minHeight: 56,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  clearButton: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: [{ translateY: -12 }],
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  conditionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  conditionPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  conditionPillSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  conditionPillText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  conditionPillTextSelected: {
    color: '#FFFFFF',
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  continueBtn: {},
  clarificationCard: {
    marginBottom: spacing.xl,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  clarificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  clarificationTitle: {
    flex: 1,
    marginBottom: spacing.sm,
  },
  clarificationOptions: {
    gap: spacing.sm,
  },
  clarificationOption: {
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionLabel: {
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  optionDescriptor: {
    lineHeight: 20,
  },
  noOptionsText: {
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
});

