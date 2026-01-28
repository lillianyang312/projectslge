import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
  Modal,
  Dimensions,
  StatusBar,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { ListStackParamList } from '../../navigation/types';
import { Text, Button, Header } from '../../ui/components';
import { colors, spacing, radius, typography } from '../../ui/tokens';
import { useItemsStore } from '../../state/itemsStore';
import { useAuthStore } from '../../state/authStore';
import { uploadImageGroup, analyzeImages, getSignedUrl } from '../../services/imageService';
import type { CategoryDetails } from '../../types/analyzeImage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type Props = NativeStackScreenProps<ListStackParamList, 'ItemVerification'>;

type Condition = 'new' | 'like_new' | 'good' | 'fair' | 'poor';

export default function ItemVerificationScreen({ navigation, route }: Props) {
  const itemIndex = route.params?.itemIndex ?? 0;

  const bulkItems = useItemsStore((state) => state.bulkItems);
  const updateBulkItem = useItemsStore((state) => state.updateBulkItem);
  const ungroupItem = useItemsStore((state) => state.ungroupItem);
  const setCurrentItemIndex = useItemsStore((state) => state.setCurrentItemIndex);
  const user = useAuthStore((state) => state.user);

  const currentItem = bulkItems[itemIndex];
  const totalItems = bulkItems.length;

  // Form state - simplified: title, category, condition, notes
  const [title, setTitle] = useState(currentItem?.verifiedTitle || currentItem?.title || '');
  const [category, setCategory] = useState(currentItem?.verifiedCategory || currentItem?.category || '');
  const [condition, setCondition] = useState<Condition>(
    (currentItem?.verifiedCondition?.toLowerCase().replace(' ', '_') as Condition) || 'good'
  );
  const [notes, setNotes] = useState(currentItem?.notes || '');

  // Category-specific fields (matching ItemDetails.tsx)
  const [categoryDetails, setCategoryDetails] = useState<CategoryDetails | undefined>(undefined);

  // Clothing-specific state
  const [clothingSize, setClothingSize] = useState('');
  const [clothingType, setClothingType] = useState('');
  const [clothingBrand, setClothingBrand] = useState('');
  const [clothingColor, setClothingColor] = useState('');
  const [clothingMaterial, setClothingMaterial] = useState('');

  // Electronics-specific state
  const [electronicsBrand, setElectronicsBrand] = useState('');
  const [electronicsModel, setElectronicsModel] = useState('');
  const [electronicsStorage, setElectronicsStorage] = useState('');
  const [electronicsColor, setElectronicsColor] = useState('');

  // Furniture-specific state
  const [furnitureMaterial, setFurnitureMaterial] = useState('');
  const [furnitureColor, setFurnitureColor] = useState('');
  const [furnitureStyle, setFurnitureStyle] = useState('');

  // Books-specific state
  const [bookAuthor, setBookAuthor] = useState('');
  const [bookSubject, setBookSubject] = useState('');

  // UI state
  const [analyzing, setAnalyzing] = useState(false);
  const analyzedRef = useRef(!!currentItem?.title);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const isKeyboardVisibleRef = useRef(false);
  const pendingAnalysisResultRef = useRef<{title?: string; category?: string; condition?: Condition} | null>(null);
  const [showFullscreenPhoto, setShowFullscreenPhoto] = useState(false);
  const [fullscreenImageUri, setFullscreenImageUri] = useState<string | null>(null);

  // Images state - mutable so user can add/remove photos
  const [images, setImages] = useState<string[]>(currentItem?.imageUris || []);
  const scrollViewRef = useRef<ScrollView>(null);
  const notesInputRef = useRef<TextInput>(null);

  // Helper to check if a field should be hidden (value is in the title)
  // Returns true if the value exists AND is found in the title (case-insensitive)
  const shouldHideField = (value: string): boolean => {
    const trimmedValue = value?.trim();
    const trimmedTitle = title?.trim();
    if (!trimmedValue || !trimmedTitle) return false;
    return trimmedTitle.toLowerCase().includes(trimmedValue.toLowerCase());
  };

  // Track keyboard visibility for extra padding
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
        isKeyboardVisibleRef.current = true;
      }
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        isKeyboardVisibleRef.current = false;
        // Apply any pending analysis results when keyboard hides
        if (pendingAnalysisResultRef.current) {
          const pending = pendingAnalysisResultRef.current;
          if (pending.title) setTitle(pending.title);
          if (pending.category) setCategory(pending.category);
          if (pending.condition) setCondition(pending.condition);
          pendingAnalysisResultRef.current = null;
        }
      }
    );
    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  // Auto-analyze images when screen loads
  useEffect(() => {
    async function analyzeItemImages() {
      if (images.length > 0 && user && !analyzedRef.current && !currentItem?.title) {
        setAnalyzing(true);
        try {
          // Upload all images as a group
          const { paths, groupId, errors } = await uploadImageGroup(images, user.id);

          if (errors.length > 0) {
            console.warn('[ItemVerification] Some images failed to upload:', errors);
          }

          console.log(`[ItemVerification] Uploaded ${paths.length} images with groupId: ${groupId}`);

          if (paths.length > 0) {
            const signedUrlPromises = paths.map((path) => getSignedUrl(path));
            const signedUrls = await Promise.all(signedUrlPromises);
            const validSignedUrls = signedUrls.filter((url): url is string => url !== null);
            const validPaths = paths.filter((_, i) => signedUrls[i] !== null);

            if (validSignedUrls.length > 0) {
              const analysisResult = await analyzeImages(validSignedUrls, validPaths);

              if (analysisResult && analysisResult.type === 'identified') {
                const newTitle = analysisResult.item.title;
                const newCategory = analysisResult.item.category;
                let newCondition: Condition | undefined;
                if (analysisResult.item.condition) {
                  const conditionLower = analysisResult.item.condition
                    .toLowerCase()
                    .replace(' ', '_') as Condition;
                  if (['new', 'like_new', 'good', 'fair', 'poor'].includes(conditionLower)) {
                    newCondition = conditionLower;
                  }
                }

                // If keyboard is visible, defer the update to avoid dismissing it
                if (isKeyboardVisibleRef.current) {
                  pendingAnalysisResultRef.current = {
                    title: newTitle,
                    category: newCategory,
                    condition: newCondition,
                  };
                } else {
                  setTitle(newTitle);
                  setCategory(newCategory);
                  if (newCondition) setCondition(newCondition);
                }

                // Populate category-specific fields from analysis
                const details = analysisResult.item.categoryDetails;
                if (details) {
                  setCategoryDetails(details);

                  // Clothing fields
                  if (details.clothing) {
                    if (details.clothing.size) setClothingSize(details.clothing.size);
                    if (details.clothing.clothingType) setClothingType(details.clothing.clothingType);
                    if (details.clothing.brand) setClothingBrand(details.clothing.brand);
                    if (details.clothing.color) setClothingColor(details.clothing.color);
                    if (details.clothing.material) setClothingMaterial(details.clothing.material);
                  }

                  // Electronics fields
                  if (details.electronics) {
                    if (details.electronics.brand) setElectronicsBrand(details.electronics.brand);
                    if (details.electronics.model) setElectronicsModel(details.electronics.model);
                    if (details.electronics.storage) setElectronicsStorage(details.electronics.storage);
                    if (details.electronics.color) setElectronicsColor(details.electronics.color);
                  }

                  // Furniture fields
                  if (details.furniture) {
                    if (details.furniture.material) setFurnitureMaterial(details.furniture.material);
                    if (details.furniture.color) setFurnitureColor(details.furniture.color);
                    if (details.furniture.style) setFurnitureStyle(details.furniture.style);
                  }

                  // Books fields
                  if (details.books) {
                    if (details.books.author) setBookAuthor(details.books.author);
                    if (details.books.subject) setBookSubject(details.books.subject);
                  }
                }

                updateBulkItem(currentItem.id, {
                  title: analysisResult.item.title,
                  category: analysisResult.item.category,
                  condition: analysisResult.item.condition,
                });
              }
            }
          }
        } catch (error) {
          console.warn('[ItemVerification] Image analysis failed:', error);
        } finally {
          setAnalyzing(false);
          analyzedRef.current = true;
        }
      }
    }

    analyzeItemImages();
  }, [images, user, itemIndex]);

  const conditionOptions: { value: Condition; label: string }[] = [
    { value: 'new', label: 'New' },
    { value: 'like_new', label: 'Like New' },
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
    { value: 'poor', label: 'Poor' },
  ];

  const openFullscreenPhoto = (uri: string) => {
    setFullscreenImageUri(uri);
    setShowFullscreenPhoto(true);
  };

  // Photo management functions
  const takePhotoWithCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need camera permissions to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const newUri = result.assets[0].uri;
      const updatedImages = [...images, newUri].slice(0, 5);
      setImages(updatedImages);
      updateBulkItem(currentItem.id, { imageUris: updatedImages });
      // Trigger re-analysis when new photo is added
      analyzedRef.current = false;
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need camera roll permissions to upload images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: Math.max(1, 5 - images.length),
    });

    if (!result.canceled && result.assets.length > 0) {
      const newUris = result.assets.map(asset => asset.uri);
      const updatedImages = [...images, ...newUris].slice(0, 5);
      setImages(updatedImages);
      updateBulkItem(currentItem.id, { imageUris: updatedImages });
      // Trigger re-analysis when new photos are added
      analyzedRef.current = false;
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
          if (buttonIndex === 1) takePhotoWithCamera();
          else if (buttonIndex === 2) pickFromGallery();
        }
      );
    } else {
      Alert.alert('Add Photo', 'Choose an option', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: takePhotoWithCamera },
        { text: 'Choose from Library', onPress: pickFromGallery },
      ]);
    }
  };

  const removePhoto = (index: number) => {
    if (images.length <= 1) {
      Alert.alert('Cannot remove', 'At least one photo is required.');
      return;
    }
    const updatedImages = images.filter((_, i) => i !== index);
    setImages(updatedImages);
    updateBulkItem(currentItem.id, { imageUris: updatedImages });
  };

  const handleDeleteItem = () => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to remove this item from your upload?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            ungroupItem(currentItem.id);
            if (totalItems <= 1) {
              navigation.navigate('Upload');
            } else if (itemIndex >= totalItems - 1) {
              navigation.goBack();
            } else {
              // Stay on same index, component will show next item
              navigation.replace('ItemVerification', { itemIndex });
            }
          },
        },
      ]
    );
  };

  const saveCurrentItem = () => {
    const conditionMap: Record<Condition, string> = {
      new: 'New',
      like_new: 'Like new',
      good: 'Good',
      fair: 'Fair',
      poor: 'Poor',
    };

    // Build an enriched title that includes category details NOT already in the title
    let enrichedTitle = title.trim();
    const categoryLower = category.toLowerCase();
    const titleEnrichments: string[] = [];

    if (categoryLower.includes('clothing')) {
      // Add details to title if not already present
      if (clothingBrand && !shouldHideField(clothingBrand)) titleEnrichments.push(clothingBrand);
      if (clothingType && !shouldHideField(clothingType)) titleEnrichments.push(clothingType);
      if (clothingSize && !shouldHideField(clothingSize)) titleEnrichments.push(`Size ${clothingSize}`);
      if (clothingColor && !shouldHideField(clothingColor)) titleEnrichments.push(clothingColor);
    } else if (categoryLower.includes('electronics')) {
      if (electronicsBrand && !shouldHideField(electronicsBrand)) titleEnrichments.push(electronicsBrand);
      if (electronicsModel && !shouldHideField(electronicsModel)) titleEnrichments.push(electronicsModel);
      if (electronicsStorage && !shouldHideField(electronicsStorage)) titleEnrichments.push(electronicsStorage);
      if (electronicsColor && !shouldHideField(electronicsColor)) titleEnrichments.push(electronicsColor);
    } else if (categoryLower.includes('furniture')) {
      if (furnitureMaterial && !shouldHideField(furnitureMaterial)) titleEnrichments.push(furnitureMaterial);
      if (furnitureColor && !shouldHideField(furnitureColor)) titleEnrichments.push(furnitureColor);
      if (furnitureStyle && !shouldHideField(furnitureStyle)) titleEnrichments.push(`${furnitureStyle} style`);
    } else if (categoryLower.includes('book')) {
      if (bookAuthor && !shouldHideField(bookAuthor)) titleEnrichments.push(`by ${bookAuthor}`);
    }

    // Append enrichments to title if any
    if (titleEnrichments.length > 0) {
      enrichedTitle = `${enrichedTitle} - ${titleEnrichments.join(', ')}`;
    }

    // Build categoryFields object for pricing service
    const categoryFields: Record<string, any> = {};
    if (categoryLower.includes('clothing')) {
      if (clothingSize) categoryFields.size = clothingSize;
      if (clothingType) categoryFields.type = clothingType;
      if (clothingBrand) categoryFields.brand = clothingBrand;
      if (clothingColor) categoryFields.color = clothingColor;
      if (clothingMaterial) categoryFields.material = clothingMaterial;
    } else if (categoryLower.includes('electronics')) {
      if (electronicsBrand) categoryFields.brand = electronicsBrand;
      if (electronicsModel) categoryFields.model = electronicsModel;
      if (electronicsStorage) categoryFields.storage = electronicsStorage;
      if (electronicsColor) categoryFields.color = electronicsColor;
    } else if (categoryLower.includes('furniture')) {
      if (furnitureMaterial) categoryFields.material = furnitureMaterial;
      if (furnitureColor) categoryFields.color = furnitureColor;
      if (furnitureStyle) categoryFields.style = furnitureStyle;
    } else if (categoryLower.includes('book')) {
      if (bookAuthor) categoryFields.author = bookAuthor;
      if (bookSubject) categoryFields.subject = bookSubject;
    }

    updateBulkItem(currentItem.id, {
      verifiedTitle: enrichedTitle || 'Untitled Item',
      verifiedCategory: category.trim() || 'General',
      verifiedCondition: conditionMap[condition],
      categoryFields,
      imageUris: images, // Save updated images
      notes: notes.trim() || undefined,
      isVerified: true,
    });
  };

  const handleNext = () => {
    saveCurrentItem();

    if (itemIndex < totalItems - 1) {
      setCurrentItemIndex(itemIndex + 1);
      navigation.push('ItemVerification', { itemIndex: itemIndex + 1 });
    } else {
      setCurrentItemIndex(0);
      navigation.navigate('BulkPriceReview', { itemIndex: 0 });
    }
  };

  const handlePrevious = () => {
    saveCurrentItem();
    if (itemIndex > 0) {
      setCurrentItemIndex(itemIndex - 1);
      navigation.goBack();
    }
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

  // Render a clearable input field (function, not component, to avoid keyboard issues)
  const renderClearableInput = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    options?: {
      multiline?: boolean;
      keyboardType?: 'default' | 'numeric';
      inputRef?: React.RefObject<TextInput>;
      onFocus?: () => void;
    }
  ) => (
    <View style={styles.inputGroup}>
      <Text variant="body" size="sm" color="muted" style={styles.inputLabel}>
        {label}
      </Text>
      <View style={styles.inputWrapper}>
        <TextInput
          ref={options?.inputRef}
          style={[styles.input, options?.multiline && styles.inputMultiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          multiline={options?.multiline}
          keyboardType={options?.keyboardType || 'default'}
          onFocus={options?.onFocus}
          blurOnSubmit={false}
          returnKeyType={options?.multiline ? 'default' : 'next'}
        />
        {value.length > 0 && (
          <Pressable style={styles.clearButton} onPress={() => onChangeText('')}>
            <Text style={styles.clearButtonText}>✕</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  if (!currentItem) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.emptyState}>
          <Text variant="body" size="lg" color="muted">No items to verify</Text>
          <Button variant="primary" onPress={() => navigation.navigate('MyList')}>
            Go to My List
          </Button>
        </View>
      </SafeAreaView>
    );
  }

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
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            isKeyboardVisible && { paddingBottom: 150 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={true}
        >
          {/* Header with item count */}
          <Header
            title={`Item ${itemIndex + 1} of ${totalItems}`}
            onBack={() => navigation.goBack()}
          />

          {/* Photo Carousel with add/remove - matching ItemDetails */}
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
                <View key={uri} style={styles.imageWrapper}>
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

          {/* Item name */}
          {renderClearableInput(
            "Item name",
            title,
            setTitle,
            analyzing ? "Analyzing..." : "What is this item?"
          )}

          {/* Category */}
          {renderClearableInput(
            "Category",
            category,
            setCategory,
            analyzing ? "Analyzing..." : "e.g. Electronics, Furniture"
          )}

          {/* Category-specific fields - Clothing (only show fields not in title) */}
          {category.toLowerCase().includes('clothing') && (
            <View style={styles.categorySection}>
              <Text variant="body" size="sm" color="accent" style={styles.categorySectionLabel}>
                Clothing Details
              </Text>
              <View style={styles.categoryFieldsRow}>
                {!shouldHideField(clothingSize) && renderClearableInput(
                  "Size",
                  clothingSize,
                  setClothingSize,
                  "e.g. M, L, 32W"
                )}
                {!shouldHideField(clothingType) && renderClearableInput(
                  "Type",
                  clothingType,
                  setClothingType,
                  "e.g. High-rise jeans"
                )}
              </View>
              <View style={styles.categoryFieldsRow}>
                {!shouldHideField(clothingBrand) && renderClearableInput(
                  "Brand",
                  clothingBrand,
                  setClothingBrand,
                  "e.g. Nike, Levi's"
                )}
                {!shouldHideField(clothingColor) && renderClearableInput(
                  "Color",
                  clothingColor,
                  setClothingColor,
                  "e.g. Navy blue"
                )}
              </View>
              {!shouldHideField(clothingMaterial) && renderClearableInput(
                "Material",
                clothingMaterial,
                setClothingMaterial,
                "e.g. Cotton, Denim"
              )}
            </View>
          )}

          {/* Category-specific fields - Electronics (only show fields not in title) */}
          {category.toLowerCase().includes('electronics') && (
            <View style={styles.categorySection}>
              <Text variant="body" size="sm" color="accent" style={styles.categorySectionLabel}>
                Electronics Details
              </Text>
              <View style={styles.categoryFieldsRow}>
                {!shouldHideField(electronicsBrand) && renderClearableInput(
                  "Brand",
                  electronicsBrand,
                  setElectronicsBrand,
                  "e.g. Apple, Samsung"
                )}
                {!shouldHideField(electronicsModel) && renderClearableInput(
                  "Model",
                  electronicsModel,
                  setElectronicsModel,
                  "e.g. iPhone 14 Pro"
                )}
              </View>
              <View style={styles.categoryFieldsRow}>
                {!shouldHideField(electronicsStorage) && renderClearableInput(
                  "Storage",
                  electronicsStorage,
                  setElectronicsStorage,
                  "e.g. 256GB"
                )}
                {!shouldHideField(electronicsColor) && renderClearableInput(
                  "Color",
                  electronicsColor,
                  setElectronicsColor,
                  "e.g. Space Gray"
                )}
              </View>
            </View>
          )}

          {/* Category-specific fields - Furniture (only show fields not in title) */}
          {category.toLowerCase().includes('furniture') && (
            <View style={styles.categorySection}>
              <Text variant="body" size="sm" color="accent" style={styles.categorySectionLabel}>
                Furniture Details
              </Text>
              <View style={styles.categoryFieldsRow}>
                {!shouldHideField(furnitureMaterial) && renderClearableInput(
                  "Material",
                  furnitureMaterial,
                  setFurnitureMaterial,
                  "e.g. Wood, Metal"
                )}
                {!shouldHideField(furnitureColor) && renderClearableInput(
                  "Color/Finish",
                  furnitureColor,
                  setFurnitureColor,
                  "e.g. Walnut, White"
                )}
              </View>
              {!shouldHideField(furnitureStyle) && renderClearableInput(
                "Style",
                furnitureStyle,
                setFurnitureStyle,
                "e.g. Modern, Mid-century"
              )}
            </View>
          )}

          {/* Category-specific fields - Books (only show fields not in title) */}
          {category.toLowerCase().includes('book') && (
            <View style={styles.categorySection}>
              <Text variant="body" size="sm" color="accent" style={styles.categorySectionLabel}>
                Book Details
              </Text>
              {!shouldHideField(bookAuthor) && renderClearableInput(
                "Author",
                bookAuthor,
                setBookAuthor,
                "e.g. John Smith"
              )}
              {!shouldHideField(bookSubject) && renderClearableInput(
                "Subject",
                bookSubject,
                setBookSubject,
                "e.g. Computer Science"
              )}
            </View>
          )}

          {/* Condition - inline pills */}
          <View style={styles.inputGroup}>
            <Text variant="body" size="sm" color="muted" style={styles.inputLabel}>
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

          {/* Notes */}
          {renderClearableInput(
            "Notes",
            notes,
            setNotes,
            "Any other details buyers should know...",
            {
              multiline: true,
              inputRef: notesInputRef,
              onFocus: scrollToNotesInput,
            }
          )}

          {/* Action Buttons */}
          <View style={styles.actions}>
            <View style={styles.actionRow}>
              {itemIndex > 0 && (
                <Button
                  variant="secondary"
                  onPress={handlePrevious}
                  style={styles.prevBtn}
                >
                  Previous
                </Button>
              )}
              <Button
                variant="primary"
                onPress={handleNext}
                style={itemIndex === 0 ? styles.fullWidthBtn : styles.nextBtn}
              >
                {itemIndex < totalItems - 1 ? 'Next Item' : 'Continue to Pricing'}
              </Button>
            </View>
            <Pressable style={styles.deleteLink} onPress={handleDeleteItem}>
              <Text style={styles.deleteLinkText}>Remove this item</Text>
            </Pressable>
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
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
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
  // Image gallery (compact - matching ItemDetails)
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
  // Category-specific section styles (matching ItemDetails)
  categorySection: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  categorySectionLabel: {
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  categoryFieldsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  // Clearable input styles (matching ItemDetails)
  inputGroup: {
    marginBottom: spacing.sm,
    flex: 1,
  },
  inputLabel: {
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
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
  inputMultiline: {
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
  // Action buttons (matching ItemDetails pattern)
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  prevBtn: {
    flex: 1,
  },
  nextBtn: {
    flex: 2,
  },
  fullWidthBtn: {
    flex: 1,
  },
  deleteLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  deleteLinkText: {
    color: colors.danger || '#E53935',
    fontSize: 14,
  },
});
