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

// Build item name by combining base title with additional category details
// Brand always comes first, then base title, then remaining details
function buildItemNameFromDetails(
  baseTitle: string,
  categoryValue: string,
  clothing: { brand: string; color: string; material: string; type: string; size: string },
  electronics: { brand: string; model: string; storage: string; color: string },
  furniture: { material: string; color: string; style: string },
  books: { author: string; subject: string }
): string {
  const categoryLower = categoryValue.toLowerCase();
  const baseTitleLower = baseTitle.toLowerCase();

  let brand = '';
  const additionalParts: string[] = [];

  if (categoryLower.includes('clothing')) {
    brand = clothing.brand;
    if (clothing.color && !baseTitleLower.includes(clothing.color.toLowerCase())) additionalParts.push(clothing.color);
    if (clothing.material && !baseTitleLower.includes(clothing.material.toLowerCase())) additionalParts.push(clothing.material);
    if (clothing.type && !baseTitleLower.includes(clothing.type.toLowerCase())) additionalParts.push(clothing.type);
    if (clothing.size && !baseTitleLower.includes(clothing.size.toLowerCase())) additionalParts.push(`Size ${clothing.size}`);
  } else if (categoryLower.includes('electronics')) {
    brand = electronics.brand;
    if (electronics.model && !baseTitleLower.includes(electronics.model.toLowerCase())) additionalParts.push(electronics.model);
    if (electronics.storage && !baseTitleLower.includes(electronics.storage.toLowerCase())) additionalParts.push(electronics.storage);
    if (electronics.color && !baseTitleLower.includes(electronics.color.toLowerCase())) additionalParts.push(electronics.color);
  } else if (categoryLower.includes('furniture')) {
    if (furniture.style && !baseTitleLower.includes(furniture.style.toLowerCase())) additionalParts.push(furniture.style);
    if (furniture.color && !baseTitleLower.includes(furniture.color.toLowerCase())) additionalParts.push(furniture.color);
    if (furniture.material && !baseTitleLower.includes(furniture.material.toLowerCase())) additionalParts.push(furniture.material);
  } else if (categoryLower.includes('book')) {
    if (books.subject && !baseTitleLower.includes(books.subject.toLowerCase())) additionalParts.push(books.subject);
    if (books.author && !baseTitleLower.includes(books.author.toLowerCase())) additionalParts.push(`by ${books.author}`);
  }

  const parts: string[] = [];
  if (brand && !baseTitleLower.includes(brand.toLowerCase())) parts.push(brand);
  parts.push(baseTitle);
  parts.push(...additionalParts);
  return parts.join(' ').trim();
}

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

  // Store the base title (from AI or user input, before category details are appended)
  const [baseTitle, setBaseTitle] = useState(currentItem?.verifiedTitle || currentItem?.title || '');
  // Track if user is currently focused on the title input (to prevent overwriting while typing)
  const titleFocusedRef = useRef(false);

  // UI state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisApplied, setAnalysisApplied] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const isKeyboardVisibleRef = useRef(false);
  const pendingAnalysisResultRef = useRef<{title?: string; category?: string; condition?: Condition} | null>(null);
  const [showFullscreenPhoto, setShowFullscreenPhoto] = useState(false);
  const [fullscreenImageUri, setFullscreenImageUri] = useState<string | null>(null);

  // Images state - mutable so user can add/remove photos
  const [images, setImages] = useState<string[]>(currentItem?.imageUris || []);
  const scrollViewRef = useRef<ScrollView>(null);
  const notesInputRef = useRef<TextInput>(null);

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
          if (pending.title) {
            setBaseTitle(pending.title);
            setTitle(pending.title);
          }
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

  // Dynamically build item name: base title + additional category details
  // Rebuilds whenever category fields change (but not while user is actively typing in title)
  useEffect(() => {
    if (titleFocusedRef.current) return;

    const combinedName = buildItemNameFromDetails(
      baseTitle,
      category,
      { brand: clothingBrand, color: clothingColor, material: clothingMaterial, type: clothingType, size: clothingSize },
      { brand: electronicsBrand, model: electronicsModel, storage: electronicsStorage, color: electronicsColor },
      { material: furnitureMaterial, color: furnitureColor, style: furnitureStyle },
      { author: bookAuthor, subject: bookSubject }
    );

    if (combinedName.trim()) {
      setTitle(combinedName);
    }
  }, [
    baseTitle, category,
    clothingBrand, clothingColor, clothingMaterial, clothingType, clothingSize,
    electronicsBrand, electronicsModel, electronicsStorage, electronicsColor,
    furnitureMaterial, furnitureColor, furnitureStyle,
    bookAuthor, bookSubject
  ]);

  // AI auto-fill triggered by button press
  const handleAutoFill = async () => {
    if (images.length === 0 || !user) return;

    setAnalyzing(true);
    setAnalysisApplied(false);
    try {
      const { paths, errors } = await uploadImageGroup(images, user.id);

      if (errors.length > 0) {
        console.warn('[ItemVerification] Some images failed to upload:', errors);
      }

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

            setBaseTitle(newTitle);

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

            const details = analysisResult.item.categoryDetails;
            if (details) {
              setCategoryDetails(details);
              if (details.clothing) {
                if (details.clothing.size) setClothingSize(details.clothing.size);
                if (details.clothing.clothingType) setClothingType(details.clothing.clothingType);
                if (details.clothing.brand) setClothingBrand(details.clothing.brand);
                if (details.clothing.color) setClothingColor(details.clothing.color);
                if (details.clothing.material) setClothingMaterial(details.clothing.material);
              }
              if (details.electronics) {
                if (details.electronics.brand) setElectronicsBrand(details.electronics.brand);
                if (details.electronics.model) setElectronicsModel(details.electronics.model);
                if (details.electronics.storage) setElectronicsStorage(details.electronics.storage);
                if (details.electronics.color) setElectronicsColor(details.electronics.color);
              }
              if (details.furniture) {
                if (details.furniture.material) setFurnitureMaterial(details.furniture.material);
                if (details.furniture.color) setFurnitureColor(details.furniture.color);
                if (details.furniture.style) setFurnitureStyle(details.furniture.style);
              }
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

            setAnalysisApplied(true);
          }
        }
      }
    } catch (error) {
      console.warn('[ItemVerification] Image analysis failed:', error);
    } finally {
      setAnalyzing(false);
    }
  };

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
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const newUri = result.assets[0].uri;
      const updatedImages = [...images, newUri].slice(0, 5);
      setImages(updatedImages);
      updateBulkItem(currentItem.id, { imageUris: updatedImages });
      setAnalysisApplied(false);
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need camera roll permissions to upload images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
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
      setAnalysisApplied(false);
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
    if (images.length <= 1 && images.length > 0) {
      Alert.alert('Cannot remove', 'At least one photo is required for items that started with photos.');
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

    // Title is already built dynamically via buildItemNameFromDetails useEffect
    const categoryLower = category.toLowerCase();

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
      verifiedTitle: title.trim() || 'Untitled Item',
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

    // Go to pricing for this item right after ID
    navigation.navigate('BulkPriceReview', { itemIndex });
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
          {/* Header with item count + AI button */}
          <Header
            title={`Item ${itemIndex + 1} of ${totalItems}`}
            onBack={() => navigation.goBack()}
            rightElement={
              images.length > 0 ? (
                analyzing ? (
                  <View style={styles.headerAiBtn}>
                    <ActivityIndicator size="small" color={colors.accent} />
                  </View>
                ) : (
                  <Pressable style={styles.headerAiBtn} onPress={handleAutoFill}>
                    <Text style={styles.headerAiBtnText}>AI</Text>
                  </Pressable>
                )
              ) : undefined
            }
          />

          {/* Photo Carousel with add/remove - hidden when no photos */}
          {images.length > 0 && (
            <View style={styles.imageGallery}>
              <View style={styles.galleryHeader}>
                <Text variant="body" size="sm" color="muted">
                  Photos ({images.length}/5)
                </Text>
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
          )}

          {/* AI applied indicator */}
          {analyzing ? (
            <View style={styles.autoFillStatus}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text variant="body" size="sm" color="accent" style={{ marginLeft: spacing.sm }}>
                Analyzing...
              </Text>
            </View>
          ) : analysisApplied ? (
            <View style={styles.autoFillApplied}>
              <Text variant="body" size="sm" color="success">✓ Auto-filled by AI</Text>
              <Pressable onPress={handleAutoFill}>
                <Text variant="body" size="xs" color="accent">Re-analyze</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Item name - editable; updates base title for auto-building */}
          <View style={styles.inputGroup}>
            <Text variant="body" size="sm" color="muted" style={styles.inputLabel}>
              Item name
            </Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={title}
                onChangeText={(text) => {
                  setBaseTitle(text);
                  setTitle(text);
                }}
                onFocus={() => { titleFocusedRef.current = true; }}
                onBlur={() => {
                  titleFocusedRef.current = false;
                  // Rebuild title with category details on blur
                  const built = buildItemNameFromDetails(
                    baseTitle, category,
                    { brand: clothingBrand, color: clothingColor, material: clothingMaterial, type: clothingType, size: clothingSize },
                    { brand: electronicsBrand, model: electronicsModel, storage: electronicsStorage, color: electronicsColor },
                    { material: furnitureMaterial, color: furnitureColor, style: furnitureStyle },
                    { author: bookAuthor, subject: bookSubject }
                  );
                  if (built.trim()) setTitle(built);
                }}
                placeholder="What is this item?"
                placeholderTextColor={colors.textMuted}
                multiline
                blurOnSubmit={false}
                returnKeyType="default"
              />
              {title.length > 0 && (
                <Pressable style={styles.clearButton} onPress={() => { setBaseTitle(''); setTitle(''); }}>
                  <Text style={styles.clearButtonText}>✕</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Category - Dropdown */}
          <View style={styles.inputGroup}>
            <Text variant="body" size="sm" color="muted" style={styles.inputLabel}>
              Category
            </Text>
            <Pressable
              style={styles.dropdownSelector}
              onPress={() => {
                const categoryOptions = [
                  'Clothing', 'Electronics', 'Furniture', 'Books', 'Kitchen',
                  'Sports', 'Toys', 'Tools', 'Home Decor', 'Collectibles', 'Other',
                ];
                if (Platform.OS === 'ios') {
                  ActionSheetIOS.showActionSheetWithOptions(
                    {
                      options: ['Cancel', ...categoryOptions],
                      cancelButtonIndex: 0,
                    },
                    (buttonIndex) => {
                      if (buttonIndex > 0) setCategory(categoryOptions[buttonIndex - 1]);
                    }
                  );
                } else {
                  Alert.alert('Select Category', undefined, [
                    { text: 'Cancel', style: 'cancel' },
                    ...categoryOptions.map((opt) => ({
                      text: opt,
                      onPress: () => setCategory(opt),
                    })),
                  ]);
                }
              }}
            >
              <Text style={[styles.dropdownText, !category && styles.dropdownPlaceholder]}>
                {category || 'Select a category...'}
              </Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </Pressable>
          </View>

          {/* Category-specific fields - Clothing */}
          {category.toLowerCase().includes('clothing') && (
            <View style={styles.categorySection}>
              <Text variant="body" size="sm" color="accent" style={styles.categorySectionLabel}>
                Clothing Details
              </Text>
              <View style={styles.categoryFieldsRow}>
                {renderClearableInput(
                  "Brand",
                  clothingBrand,
                  setClothingBrand,
                  "e.g. Nike, Levi's"
                )}
                {renderClearableInput(
                  "Type",
                  clothingType,
                  setClothingType,
                  "e.g. High-rise jeans"
                )}
              </View>
              <View style={styles.categoryFieldsRow}>
                {renderClearableInput(
                  "Color",
                  clothingColor,
                  setClothingColor,
                  "e.g. Navy blue"
                )}
                {renderClearableInput(
                  "Size",
                  clothingSize,
                  setClothingSize,
                  "e.g. M, L, 32W"
                )}
              </View>
              {renderClearableInput(
                "Material",
                clothingMaterial,
                setClothingMaterial,
                "e.g. Cotton, Denim"
              )}
            </View>
          )}

          {/* Category-specific fields - Electronics */}
          {category.toLowerCase().includes('electronics') && (
            <View style={styles.categorySection}>
              <Text variant="body" size="sm" color="accent" style={styles.categorySectionLabel}>
                Electronics Details
              </Text>
              <View style={styles.categoryFieldsRow}>
                {renderClearableInput(
                  "Brand",
                  electronicsBrand,
                  setElectronicsBrand,
                  "e.g. Apple, Samsung"
                )}
                {renderClearableInput(
                  "Model",
                  electronicsModel,
                  setElectronicsModel,
                  "e.g. iPhone 14 Pro"
                )}
              </View>
              <View style={styles.categoryFieldsRow}>
                {renderClearableInput(
                  "Storage",
                  electronicsStorage,
                  setElectronicsStorage,
                  "e.g. 256GB"
                )}
                {renderClearableInput(
                  "Color",
                  electronicsColor,
                  setElectronicsColor,
                  "e.g. Space Gray"
                )}
              </View>
            </View>
          )}

          {/* Category-specific fields - Furniture */}
          {category.toLowerCase().includes('furniture') && (
            <View style={styles.categorySection}>
              <Text variant="body" size="sm" color="accent" style={styles.categorySectionLabel}>
                Furniture Details
              </Text>
              <View style={styles.categoryFieldsRow}>
                {renderClearableInput(
                  "Material",
                  furnitureMaterial,
                  setFurnitureMaterial,
                  "e.g. Wood, Metal"
                )}
                {renderClearableInput(
                  "Color/Finish",
                  furnitureColor,
                  setFurnitureColor,
                  "e.g. Walnut, White"
                )}
              </View>
              {renderClearableInput(
                "Style",
                furnitureStyle,
                setFurnitureStyle,
                "e.g. Modern, Mid-century"
              )}
            </View>
          )}

          {/* Category-specific fields - Books */}
          {category.toLowerCase().includes('book') && (
            <View style={styles.categorySection}>
              <Text variant="body" size="sm" color="accent" style={styles.categorySectionLabel}>
                Book Details
              </Text>
              {renderClearableInput(
                "Author",
                bookAuthor,
                setBookAuthor,
                "e.g. John Smith"
              )}
              {renderClearableInput(
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

          {/* Browse preview — shows exactly what buyers will see */}
          {(title.trim() || category || images.length > 0) && (
            <View style={styles.browsePreviewSection}>
              <Text variant="body" size="sm" color="muted" style={styles.inputLabel}>
                Browse Preview
              </Text>
              <View style={styles.browsePreviewCard}>
                <View style={styles.browsePreviewThumb}>
                  {images[0] ? (
                    <Image source={{ uri: images[0] }} style={styles.browsePreviewImage} resizeMode="cover" />
                  ) : (
                    <Text style={styles.browsePreviewEmoji}>{'\u{1F4E6}'}</Text>
                  )}
                </View>
                <View style={styles.browsePreviewInfo}>
                  <Text style={styles.browsePreviewTitle} numberOfLines={1}>
                    {title.trim() || 'Untitled Item'}
                  </Text>
                  <View style={styles.browsePreviewBadges}>
                    {category ? (
                      <View style={styles.browsePreviewBadge}>
                        <Text style={styles.browsePreviewBadgeText}>{category}</Text>
                      </View>
                    ) : null}
                    {condition ? (
                      <View style={[styles.browsePreviewBadge, styles.browsePreviewConditionBadge]}>
                        <Text style={styles.browsePreviewBadgeText}>
                          {conditionOptions.find((c) => c.value === condition)?.label || condition}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.browsePreviewPriceHint}>Price added next step</Text>
                </View>
              </View>
            </View>
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
                Continue to Pricing
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
  // Header AI button styles
  headerAiBtn: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    minHeight: 32,
  },
  headerAiBtnText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  dropdownText: {
    fontFamily: typography?.fonts?.body || 'DMSans_400Regular',
    fontSize: typography?.sizes?.md || 14,
    color: colors.textPrimary,
    flex: 1,
  },
  dropdownPlaceholder: {
    color: colors.textMuted,
  },
  dropdownArrow: {
    color: colors.textMuted,
    fontSize: 10,
    marginLeft: spacing.sm,
  },
  autoFillStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  autoFillApplied: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  // Browse preview styles
  browsePreviewSection: {
    marginBottom: spacing.md,
  },
  browsePreviewCard: {
    width: 140,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  browsePreviewThumb: {
    width: 140,
    height: 140,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  browsePreviewImage: {
    width: '100%',
    height: '100%',
  },
  browsePreviewEmoji: {
    fontSize: 32,
  },
  browsePreviewInfo: {
    padding: spacing.sm,
  },
  browsePreviewTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  browsePreviewBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  browsePreviewBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  browsePreviewConditionBadge: {
    backgroundColor: '#E3F2FD',
  },
  browsePreviewBadgeText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  browsePreviewPriceHint: {
    fontSize: 10,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
});
