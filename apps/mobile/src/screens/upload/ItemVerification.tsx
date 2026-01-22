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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ListStackParamList } from '../../navigation/types';
import { Text, Button } from '../../ui/components';
import { colors, spacing, radius, typography } from '../../ui/tokens';
import { useItemsStore } from '../../state/itemsStore';
import { useAuthStore } from '../../state/authStore';
import { uploadImageGroup, analyzeImages, getSignedUrl } from '../../services/imageService';
import { getCategoryFields, getAllCategories, CategoryField } from '../../config/categoryFields';

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

  // Track which fields were manually edited (these take priority)
  const [manualEdits, setManualEdits] = useState<Set<string>>(new Set());

  // Form state - simplified: title, category, condition, category-specific fields, notes
  const [title, setTitle] = useState(currentItem?.verifiedTitle || currentItem?.title || '');
  const [category, setCategory] = useState(currentItem?.verifiedCategory || currentItem?.category || '');
  const [condition, setCondition] = useState<Condition>(
    (currentItem?.verifiedCondition?.toLowerCase().replace(' ', '_') as Condition) || 'good'
  );
  const [categoryFields, setCategoryFields] = useState<Record<string, any>>(
    currentItem?.categoryFields || {}
  );
  const [notes, setNotes] = useState(currentItem?.notes || '');

  // UI state
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(!!currentItem?.title);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const images = currentItem?.imageUris || [];
  const dynamicFields = getCategoryFields(category);
  const availableCategories = getAllCategories();
  const scrollViewRef = useRef<ScrollView>(null);
  const notesInputRef = useRef<TextInput>(null);

  // Track manual edits
  const markAsManualEdit = (field: string) => {
    setManualEdits((prev) => new Set(prev).add(field));
  };

  // Auto-analyze images when screen loads
  useEffect(() => {
    async function analyzeItemImages() {
      if (images.length > 0 && user && !analyzed && !currentItem?.title) {
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
                // Only set AI values if not manually edited
                if (!manualEdits.has('title')) setTitle(analysisResult.item.title);
                if (!manualEdits.has('category')) setCategory(analysisResult.item.category);
                if (!manualEdits.has('condition') && analysisResult.item.condition) {
                  const conditionLower = analysisResult.item.condition
                    .toLowerCase()
                    .replace(' ', '_') as Condition;
                  if (['new', 'like_new', 'good', 'fair', 'poor'].includes(conditionLower)) {
                    setCondition(conditionLower);
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
          setAnalyzed(true);
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

  const handleCategoryFieldChange = (key: string, value: any) => {
    setCategoryFields({ ...categoryFields, [key]: value });
    markAsManualEdit(`categoryField_${key}`);
  };

  const clearField = (field: string) => {
    switch (field) {
      case 'title':
        setTitle('');
        break;
      case 'category':
        setCategory('');
        break;
      case 'notes':
        setNotes('');
        break;
    }
    markAsManualEdit(field);
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

    updateBulkItem(currentItem.id, {
      verifiedTitle: title.trim() || 'Untitled Item',
      verifiedCategory: category.trim() || 'General',
      verifiedCondition: conditionMap[condition],
      categoryFields,
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

  // Clearable input component
  const ClearableInput = ({
    label,
    value,
    onChangeText,
    fieldKey,
    placeholder,
    multiline = false,
    keyboardType = 'default',
    inputRef,
    onFocus,
  }: {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    fieldKey: string;
    placeholder?: string;
    multiline?: boolean;
    keyboardType?: 'default' | 'numeric';
    inputRef?: React.RefObject<TextInput>;
    onFocus?: () => void;
  }) => (
    <View style={styles.inputRow}>
      <View style={styles.inputContainer}>
        <Text variant="body" size="sm" color="muted" style={styles.inputLabel}>
          {label}
        </Text>
        <TextInput
          ref={inputRef}
          style={[styles.input, multiline && styles.inputMultiline]}
          value={value}
          onChangeText={(text) => {
            onChangeText(text);
            markAsManualEdit(fieldKey);
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          multiline={multiline}
          keyboardType={keyboardType}
          onFocus={onFocus}
        />
      </View>
      {value.length > 0 && (
        <Pressable style={styles.clearButton} onPress={() => clearField(fieldKey)}>
          <Text style={styles.clearButtonText}>✕</Text>
        </Pressable>
      )}
    </View>
  );

  if (!currentItem) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Back</Text>
          </Pressable>
        </View>
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
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Compact Header with Delete */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Text style={styles.backButton}>←</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text variant="bodyMedium" size="base">
              Item {itemIndex + 1}/{totalItems}
            </Text>
            {/* Mini progress dots */}
            <View style={styles.miniProgress}>
              {Array.from({ length: totalItems }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.miniDot,
                    i <= itemIndex && styles.miniDotActive,
                  ]}
                />
              ))}
            </View>
          </View>
          <Pressable onPress={handleDeleteItem} style={styles.headerButton}>
            <Text style={styles.deleteButton}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          {/* Compact Image Row */}
          <View style={styles.imageRow}>
            {images.slice(0, 3).map((uri, idx) => (
              <View key={uri} style={styles.thumbnailWrapper}>
                <Image source={{ uri }} style={styles.thumbnail} />
                {analyzing && idx === 0 && (
                  <View style={styles.analyzingMini}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}
              </View>
            ))}
            {images.length > 3 && (
              <View style={styles.moreImages}>
                <Text style={styles.moreImagesText}>+{images.length - 3}</Text>
              </View>
            )}
          </View>

          {/* Main Fields - Compact */}
          <View style={styles.section}>
            <ClearableInput
              label="Item Name"
              value={title}
              onChangeText={setTitle}
              fieldKey="title"
              placeholder={analyzing ? 'Analyzing...' : 'What is this?'}
            />

            {/* Category - Inline */}
            <View style={styles.inputRow}>
              <View style={styles.inputContainer}>
                <Text variant="body" size="sm" color="muted" style={styles.inputLabel}>
                  Category
                </Text>
                <Pressable
                  style={styles.categoryButton}
                  onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                >
                  <Text
                    variant="body"
                    size="base"
                    color={category ? 'primary' : 'muted'}
                    numberOfLines={1}
                  >
                    {category || 'Select'}
                  </Text>
                  <Text style={styles.dropdownIcon}>{showCategoryPicker ? '▲' : '▼'}</Text>
                </Pressable>
              </View>
              {category.length > 0 && (
                <Pressable style={styles.clearButton} onPress={() => clearField('category')}>
                  <Text style={styles.clearButtonText}>✕</Text>
                </Pressable>
              )}
            </View>

            {showCategoryPicker && (
              <ScrollView style={styles.categoryList} nestedScrollEnabled>
                {availableCategories.map((cat) => (
                  <Pressable
                    key={cat}
                    style={[styles.categoryOption, category === cat && styles.categoryOptionSelected]}
                    onPress={() => {
                      setCategory(cat);
                      setShowCategoryPicker(false);
                      markAsManualEdit('category');
                    }}
                  >
                    <Text variant="body" size="sm" color={category === cat ? 'accent' : 'primary'}>
                      {cat}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

          </View>

          {/* Condition - inline pills */}
          <View style={styles.section}>
            <Text variant="body" size="sm" color="muted" style={styles.sectionLabel}>
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
                  onPress={() => {
                    setCondition(option.value);
                    markAsManualEdit('condition');
                  }}
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

          {/* Category-Specific ID Fields */}
          {category && dynamicFields.length > 0 && (
            <View style={styles.section}>
              <Text variant="body" size="sm" color="muted" style={styles.sectionLabel}>
                {category} Details
              </Text>
              <View style={styles.fieldGrid}>
                {dynamicFields.slice(0, 4).map((field) => {
                  const value = categoryFields[field.key] || '';
                  if (field.type === 'select' && field.options) {
                    return (
                      <View key={field.key} style={styles.fieldItem}>
                        <Text variant="body" size="xs" color="muted">{field.label}</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View style={styles.miniPills}>
                            {field.options.slice(0, 5).map((opt) => (
                              <Pressable
                                key={opt}
                                style={[styles.miniPill, value === opt && styles.miniPillActive]}
                                onPress={() => handleCategoryFieldChange(field.key, opt)}
                              >
                                <Text
                                  style={[styles.miniPillText, value === opt && styles.miniPillTextActive]}
                                >
                                  {opt}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </ScrollView>
                      </View>
                    );
                  }
                  return (
                    <View key={field.key} style={styles.fieldItem}>
                      <Text variant="body" size="xs" color="muted">
                        {field.label}{field.unit ? ` (${field.unit})` : ''}
                      </Text>
                      <TextInput
                        style={styles.miniInput}
                        value={value.toString()}
                        onChangeText={(text) => handleCategoryFieldChange(field.key, text)}
                        placeholder={field.placeholder}
                        placeholderTextColor={colors.textMuted}
                        keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Additional Notes */}
          <View style={styles.section}>
            <ClearableInput
              label="Additional Notes (optional)"
              value={notes}
              onChangeText={setNotes}
              fieldKey="notes"
              placeholder="Any other details buyers should know..."
              multiline
              inputRef={notesInputRef}
              onFocus={scrollToNotesInput}
            />
          </View>
        </ScrollView>

        {/* Fixed Bottom Navigation */}
        <View style={styles.bottomNav}>
          {itemIndex > 0 ? (
            <Pressable style={styles.navButtonSecondary} onPress={handlePrevious}>
              <Text style={styles.navButtonSecondaryText}>← Prev</Text>
            </Pressable>
          ) : (
            <View style={styles.navButtonPlaceholder} />
          )}
          <Pressable style={styles.navButtonPrimary} onPress={handleNext}>
            <Text style={styles.navButtonPrimaryText}>
              {itemIndex < totalItems - 1 ? 'Next →' : 'Pricing →'}
            </Text>
          </Pressable>
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  backButton: {
    fontSize: 24,
    color: colors.textPrimary,
  },
  deleteButton: {
    fontSize: 20,
    color: colors.danger || '#E53935',
    fontWeight: '600',
  },
  miniProgress: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  miniDotActive: {
    backgroundColor: colors.accent,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  imageRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  thumbnailWrapper: {
    position: 'relative',
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
  },
  analyzingMini: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreImages: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreImagesText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
  inputContainer: {
    flex: 1,
  },
  inputLabel: {
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.textPrimary,
    fontFamily: typography?.fonts?.body || 'DMSans_400Regular',
  },
  inputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  clearButton: {
    width: 36,
    height: 36,
    marginLeft: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearButtonText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  categoryButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dropdownIcon: {
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  categoryList: {
    maxHeight: 150,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    marginBottom: spacing.sm,
  },
  categoryOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryOptionSelected: {
    backgroundColor: colors.accentSoft,
  },
  fieldGrid: {
    gap: spacing.sm,
  },
  fieldItem: {
    marginBottom: spacing.xs,
  },
  miniInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 2,
  },
  miniPills: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  miniPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  miniPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  miniPillText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  miniPillTextActive: {
    color: '#FFFFFF',
  },
  pillRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
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
  bottomNav: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    gap: spacing.md,
  },
  navButtonPlaceholder: {
    flex: 1,
  },
  navButtonSecondary: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  navButtonSecondaryText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  navButtonPrimary: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  navButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
