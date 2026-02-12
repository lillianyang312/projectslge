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
import type { AnalyzeImageResponse, CategoryDetails, ClothingDetails, ElectronicsDetails, FurnitureDetails, BookDetails } from '../../types/analyzeImage';
import { isNeedsClarificationResponse } from '../../schemas/clarification_schema';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type Props = NativeStackScreenProps<ListStackParamList, 'ItemDetails'>;

type Condition = 'new' | 'like_new' | 'good' | 'fair' | 'poor';

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

  // Extract brand first (across all categories)
  let brand = '';
  const additionalParts: string[] = [];

  if (categoryLower.includes('clothing')) {
    brand = clothing.brand;
    if (clothing.color && !baseTitleLower.includes(clothing.color.toLowerCase())) {
      additionalParts.push(clothing.color);
    }
    if (clothing.material && !baseTitleLower.includes(clothing.material.toLowerCase())) {
      additionalParts.push(clothing.material);
    }
    if (clothing.type && !baseTitleLower.includes(clothing.type.toLowerCase())) {
      additionalParts.push(clothing.type);
    }
    if (clothing.size && !baseTitleLower.includes(clothing.size.toLowerCase())) {
      additionalParts.push(`Size ${clothing.size}`);
    }
  } else if (categoryLower.includes('electronics')) {
    brand = electronics.brand;
    if (electronics.model && !baseTitleLower.includes(electronics.model.toLowerCase())) {
      additionalParts.push(electronics.model);
    }
    if (electronics.storage && !baseTitleLower.includes(electronics.storage.toLowerCase())) {
      additionalParts.push(electronics.storage);
    }
    if (electronics.color && !baseTitleLower.includes(electronics.color.toLowerCase())) {
      additionalParts.push(electronics.color);
    }
  } else if (categoryLower.includes('furniture')) {
    // Furniture has no brand field
    if (furniture.style && !baseTitleLower.includes(furniture.style.toLowerCase())) {
      additionalParts.push(furniture.style);
    }
    if (furniture.color && !baseTitleLower.includes(furniture.color.toLowerCase())) {
      additionalParts.push(furniture.color);
    }
    if (furniture.material && !baseTitleLower.includes(furniture.material.toLowerCase())) {
      additionalParts.push(furniture.material);
    }
  } else if (categoryLower.includes('book')) {
    if (books.subject && !baseTitleLower.includes(books.subject.toLowerCase())) {
      additionalParts.push(books.subject);
    }
    if (books.author && !baseTitleLower.includes(books.author.toLowerCase())) {
      additionalParts.push(`by ${books.author}`);
    }
  }

  // Build title: Brand first, then base title (without brand duplication), then additional parts
  const parts: string[] = [];
  if (brand && !baseTitleLower.includes(brand.toLowerCase())) {
    parts.push(brand);
  }
  parts.push(baseTitle);
  parts.push(...additionalParts);

  return parts.join(' ').trim();
}


export default function ItemDetailsScreen({ navigation }: Props) {
  const draft = useItemsStore((state) => state.draft);
  const updateDraft = useItemsStore((state) => state.updateDraft);
  const user = useAuthStore((state) => state.user);

  // Form state - title is kept for AI analysis results, not shown to user
  const [title, setTitle] = useState(draft?.title || '');
  const [category, setCategory] = useState(draft?.category || '');
  const [condition, setCondition] = useState<Condition>('good');
  const [notes, setNotes] = useState(draft?.notes || '');

  // Category-specific fields
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

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisApplied, setAnalysisApplied] = useState(false);
  const [images, setImages] = useState<string[]>(draft?.imageUris || [draft?.imageUri].filter(Boolean) || []);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [showFullscreenPhoto, setShowFullscreenPhoto] = useState(false);
  const [fullscreenImageUri, setFullscreenImageUri] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const notesInputRef = useRef<TextInput>(null);
  const isKeyboardVisibleRef = useRef(false);
  const pendingAnalysisResultRef = useRef<{title?: string; category?: string; condition?: Condition} | null>(null);

  // Store the base AI-detected title (before user adds details)
  const [baseTitle, setBaseTitle] = useState(draft?.title || '');
  // Track if user has manually edited the title (to prevent auto-overwriting)
  const userEditedTitleRef = useRef(false);


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
            userEditedTitleRef.current = false;
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

  // Dynamically build item name: base AI title + additional category details
  useEffect(() => {
    // Skip if user has manually edited the title
    if (userEditedTitleRef.current) return;

    // Combine base title with any additional details user has entered
    const combinedName = buildItemNameFromDetails(
      baseTitle,
      category,
      { brand: clothingBrand, color: clothingColor, material: clothingMaterial, type: clothingType, size: clothingSize },
      { brand: electronicsBrand, model: electronicsModel, storage: electronicsStorage, color: electronicsColor },
      { material: furnitureMaterial, color: furnitureColor, style: furnitureStyle },
      { author: bookAuthor, subject: bookSubject }
    );

    // Update the title with the combined name
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

  // Category options for dropdown
  const categoryOptions = [
    'Clothing',
    'Electronics',
    'Furniture',
    'Books',
    'Kitchen',
    'Sports',
    'Toys',
    'Tools',
    'Home Decor',
    'Collectibles',
    'Other',
  ];

  // Auto-detect category from item name keywords
  const detectCategoryFromTitle = (titleText: string) => {
    const titleLower = titleText.toLowerCase();

    // Clothing keywords
    const clothingKeywords = ['shirt', 'pants', 'jeans', 'dress', 'jacket', 'coat', 'sweater', 'hoodie', 'shorts', 'skirt', 'blouse', 'top', 'tee', 't-shirt', 'polo', 'cardigan', 'blazer', 'suit', 'vest', 'leggings', 'joggers', 'sweatpants', 'underwear', 'socks', 'shoes', 'sneakers', 'boots', 'sandals', 'heels', 'hat', 'cap', 'scarf', 'gloves', 'belt', 'tie', 'clothing', 'apparel', 'wear'];

    // Electronics keywords
    const electronicsKeywords = ['phone', 'iphone', 'samsung', 'android', 'laptop', 'macbook', 'computer', 'pc', 'tablet', 'ipad', 'monitor', 'tv', 'television', 'speaker', 'headphones', 'earbuds', 'airpods', 'watch', 'smartwatch', 'camera', 'gopro', 'drone', 'console', 'playstation', 'xbox', 'nintendo', 'switch', 'keyboard', 'mouse', 'charger', 'cable', 'electronics', 'tech', 'device'];

    // Furniture keywords
    const furnitureKeywords = ['chair', 'table', 'desk', 'sofa', 'couch', 'bed', 'mattress', 'dresser', 'drawer', 'cabinet', 'shelf', 'bookshelf', 'lamp', 'mirror', 'rug', 'carpet', 'curtain', 'ottoman', 'bench', 'stool', 'nightstand', 'wardrobe', 'closet', 'furniture', 'ikea'];

    // Books keywords
    const bookKeywords = ['book', 'textbook', 'novel', 'manga', 'comic', 'magazine', 'journal', 'notebook', 'planner', 'guide', 'manual', 'edition', 'hardcover', 'paperback', 'isbn'];

    // Kitchen keywords
    const kitchenKeywords = ['pot', 'pan', 'knife', 'blender', 'mixer', 'toaster', 'microwave', 'kettle', 'dishes', 'plates', 'cups', 'utensils', 'cookware', 'kitchen'];

    // Sports keywords
    const sportsKeywords = ['ball', 'racket', 'bat', 'glove', 'helmet', 'bike', 'bicycle', 'skateboard', 'weights', 'dumbbell', 'yoga', 'fitness', 'sports', 'gym', 'exercise'];

    // Check which category the title matches
    if (clothingKeywords.some(keyword => titleLower.includes(keyword))) {
      return 'Clothing';
    } else if (electronicsKeywords.some(keyword => titleLower.includes(keyword))) {
      return 'Electronics';
    } else if (furnitureKeywords.some(keyword => titleLower.includes(keyword))) {
      return 'Furniture';
    } else if (bookKeywords.some(keyword => titleLower.includes(keyword))) {
      return 'Books';
    } else if (kitchenKeywords.some(keyword => titleLower.includes(keyword))) {
      return 'Kitchen';
    } else if (sportsKeywords.some(keyword => titleLower.includes(keyword))) {
      return 'Sports';
    }
    return null;
  };

  // Handle item name submit (when user presses enter/done)
  const handleTitleSubmit = () => {
    const detectedCategory = detectCategoryFromTitle(title);
    if (detectedCategory) {
      setCategory(detectedCategory);
    }
  };

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

  // AI auto-fill triggered by button press
  const handleAutoFill = async () => {
    const imagesToAnalyze = images.length > 0 ? images : (draft?.imageUri ? [draft.imageUri] : []);
    if (imagesToAnalyze.length === 0 || !user) return;

    setAnalyzing(true);
    setAnalysisApplied(false);
    try {
      const { paths, errors } = await uploadImageGroup(imagesToAnalyze, user.id);

      if (errors.length > 0) {
        console.warn('[ItemDetails] Some images failed to upload:', errors);
      }

      if (paths.length > 0) {
        const signedUrlPromises = paths.map(path => getSignedUrlCached(path));
        const signedUrls = await Promise.all(signedUrlPromises);
        const validSignedUrls = signedUrls.filter((url): url is string => url !== null);
        const validPaths = paths.filter((_, i) => signedUrls[i] !== null);

        if (validSignedUrls.length > 0) {
          const analysisResult = await analyzeImages(validSignedUrls, validPaths);

          if (analysisResult) {
            if (analysisResult.type === 'identified') {
              const newTitle = analysisResult.item.title;
              const newCategory = analysisResult.item.category;
              let newCondition: Condition | undefined;
              if (analysisResult.item.condition) {
                const conditionLower = analysisResult.item.condition.toLowerCase().replace(' ', '_') as Condition;
                if (['new', 'like_new', 'good', 'fair', 'poor'].includes(conditionLower)) {
                  newCondition = conditionLower;
                }
              }

              setBaseTitle(newTitle);
              userEditedTitleRef.current = false;

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

              setAnalysisApplied(true);
            }

            updateDraft({
              clarificationResponse: analysisResult,
            });
          }
        }
      }
    } catch (error) {
      console.warn('Image analysis failed:', error);
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
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const newUri = result.assets[0].uri;
      const updatedImages = [...images, newUri].slice(0, 5); // Max 5 images
      setImages(updatedImages);
      updateDraft({ imageUris: updatedImages });
      setAnalysisApplied(false);
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
      mediaTypes: ['images'],
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

    const categoryLower = category.toLowerCase();

    // Pass category-specific details to draft for title building in PriceReview
    const clothingDetails = categoryLower.includes('clothing') ? {
      brand: clothingBrand.trim(),
      type: clothingType.trim(),
      color: clothingColor.trim(),
      size: clothingSize.trim(),
      material: clothingMaterial.trim(),
    } : undefined;

    const electronicsDetails = categoryLower.includes('electronics') ? {
      brand: electronicsBrand.trim(),
      model: electronicsModel.trim(),
      storage: electronicsStorage.trim(),
      color: electronicsColor.trim(),
    } : undefined;

    const furnitureDetails = categoryLower.includes('furniture') ? {
      material: furnitureMaterial.trim(),
      color: furnitureColor.trim(),
      style: furnitureStyle.trim(),
    } : undefined;

    const bookDetails = categoryLower.includes('book') ? {
      author: bookAuthor.trim(),
      subject: bookSubject.trim(),
    } : undefined;

    updateDraft({
      title: title.trim() || undefined, // May be empty, title built in PriceReview
      category: category.trim() || 'General',
      condition: conditionMap[condition],
      notes: notes.trim() || undefined,
      clothingDetails,
      electronicsDetails,
      furnitureDetails,
      bookDetails,
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

  // Render a clearable input field
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
      onSubmitEditing?: () => void;
    }
  ) => (
    <View style={styles.inputGroup}>
      <Text variant="body" size="sm" color="muted" style={styles.label}>
        {label}
      </Text>
      <View style={styles.inputWrapper}>
        <TextInput
          ref={options?.inputRef}
          style={[styles.clearableInput, options?.multiline && styles.multilineInput]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          multiline={options?.multiline}
          keyboardType={options?.keyboardType || 'default'}
          onFocus={options?.onFocus}
          onSubmitEditing={options?.onSubmitEditing}
          blurOnSubmit={options?.onSubmitEditing ? true : false}
          returnKeyType={options?.onSubmitEditing ? 'done' : (options?.multiline ? 'default' : 'next')}
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
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={true}
        >
          <Header
            title="Item details"
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

        {/* Compact Photo Thumbnails - hidden when no photos */}
        {images.length > 0 && (
          <View style={styles.imageGallery}>
            <View style={styles.galleryHeader}>
              <Text variant="body" size="sm" color="muted">
                Photos ({images.length}/5)
              </Text>
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

        {/* Item Name - editable (user edits stop auto-building) */}
        {renderClearableInput(
          "Item Name",
          title,
          (text) => {
            userEditedTitleRef.current = true;
            setTitle(text);
          },
          "e.g. Nike Air Max 90 Sneakers",
          { multiline: true, onSubmitEditing: handleTitleSubmit }
        )}

        {/* Category - Dropdown */}
        <View style={styles.inputGroup}>
          <Text variant="body" size="sm" color="muted" style={styles.label}>
            Category
          </Text>
          <Pressable
            style={styles.dropdownSelector}
            onPress={() => {
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

        {/* Notes */}
        {renderClearableInput(
          "Notes",
          notes,
          setNotes,
          "Add any additional details here",
          {
            multiline: true,
            inputRef: notesInputRef,
            onFocus: scrollToNotesInput,
          }
        )}

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
  // Category-specific section styles
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
  // Category dropdown styles
  categoryScrollView: {
    marginHorizontal: -spacing.lg,
  },
  categoryScrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  categoryPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryPillSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  categoryPillText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  categoryPillTextSelected: {
    color: '#FFFFFF',
  },
  // Clearable input styles
  inputGroup: {
    marginBottom: spacing.sm,
    flex: 1,
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
    borderColor: colors.success,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
});

