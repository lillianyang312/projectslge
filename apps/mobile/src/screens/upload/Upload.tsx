import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Pressable,
  Alert,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { ListStackParamList } from '../../navigation/types';
import { Text, Button, Header } from '../../ui/components';
import { colors, spacing, radius, typography } from '../../ui/tokens';
import { useItemsStore } from '../../state/itemsStore';

type Props = NativeStackScreenProps<ListStackParamList, 'Upload'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = spacing.sm;
const GRID_PADDING = spacing.xxl;
const COLUMNS = 3;
const ITEM_SIZE = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS;

export default function UploadScreen({ navigation }: Props) {
  const setDraftFromImage = useItemsStore((state) => state.setDraftFromImage);
  const updateDraft = useItemsStore((state) => state.updateDraft);
  const draft = useItemsStore((state) => state.draft);
  const setBulkPhotos = useItemsStore((state) => state.setBulkPhotos);
  const bulkPhotos = useItemsStore((state) => state.bulkPhotos);
  const clearBulkUpload = useItemsStore((state) => state.clearBulkUpload);

  const [selectedPhotos, setSelectedPhotos] = useState<string[]>(bulkPhotos);

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'We need camera permissions to take photos.'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const newUri = result.assets[0].uri;
      const updatedPhotos = [...selectedPhotos, newUri];
      setSelectedPhotos(updatedPhotos);
    }
  };

  const pickFromLibrary = async () => {
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
    });

    if (!result.canceled && result.assets.length > 0) {
      const newUris = result.assets.map((asset) => asset.uri);
      const updatedPhotos = [...selectedPhotos, ...newUris];
      setSelectedPhotos(updatedPhotos);
    }
  };

  const removePhoto = (uri: string) => {
    setSelectedPhotos(selectedPhotos.filter((p) => p !== uri));
  };

  const handleContinueToGrouping = () => {
    if (selectedPhotos.length === 0) {
      Alert.alert('No photos', 'Please add at least one photo to continue.');
      return;
    }

    // Store photos in bulk upload state
    setBulkPhotos(selectedPhotos);

    // Navigate to grouping screen
    navigation.navigate('ItemGrouping');
  };

  const handleSingleItemFlow = () => {
    if (selectedPhotos.length === 0) {
      Alert.alert('No photos', 'Please add at least one photo to continue.');
      return;
    }

    // Use existing single-item flow
    setDraftFromImage(selectedPhotos[0]);
    updateDraft({ imageUris: selectedPhotos });
    navigation.navigate('ItemDetails');
  };

  const handleBack = () => {
    // Clear bulk upload state when going back
    clearBulkUpload();
    setSelectedPhotos([]);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Header
        title="Add items"
        onBack={handleBack}
        style={styles.header}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {selectedPhotos.length === 0 ? (
          <View style={styles.content}>
            {/* Main action: Take Photo */}
            <Pressable style={styles.uploadZone} onPress={takePhoto}>
              <View style={styles.uploadIcon}>
                <Text style={styles.uploadIconText}>+</Text>
              </View>
              <Text variant="body" size="lg" color="secondary" style={styles.uploadText}>
                Tap to take a photo
              </Text>
            </Pressable>

            {/* Secondary action: Upload from Library */}
            <Button variant="secondary" onPress={pickFromLibrary} style={styles.libraryButton}>
              Upload from Library
            </Button>
          </View>
        ) : (
          <View style={styles.gridContent}>
            {/* Photo count header */}
            <View style={styles.photoCountHeader}>
              <Text variant="headingMedium" size="lg">
                {selectedPhotos.length} photo{selectedPhotos.length !== 1 ? 's' : ''} selected
              </Text>
              <Text variant="body" size="sm" color="muted">
                Tap a photo to remove it
              </Text>
            </View>

            {/* Photo grid */}
            <View style={styles.photoGrid}>
              {selectedPhotos.map((uri, index) => (
                <Pressable
                  key={uri}
                  style={styles.photoItem}
                  onPress={() => removePhoto(uri)}
                >
                  <Image source={{ uri }} style={styles.photoImage} />
                  <View style={styles.removeOverlay}>
                    <Text style={styles.removeIcon}>✕</Text>
                  </View>
                  <View style={styles.photoNumber}>
                    <Text style={styles.photoNumberText}>{index + 1}</Text>
                  </View>
                </Pressable>
              ))}

              {/* Add more photos button */}
              <Pressable style={styles.addMoreButton} onPress={pickFromLibrary}>
                <Text style={styles.addMoreIcon}>+</Text>
                <Text variant="body" size="xs" color="secondary">
                  Add more
                </Text>
              </Pressable>
            </View>

            {/* Take another photo */}
            <Button
              variant="secondary"
              onPress={takePhoto}
              style={styles.takePhotoButton}
            >
              Take another photo
            </Button>

            {/* Action buttons */}
            <View style={styles.actionButtons}>
              {selectedPhotos.length === 1 ? (
                <Button
                  variant="primary"
                  onPress={handleSingleItemFlow}
                  style={styles.continueButton}
                >
                  Continue with 1 item
                </Button>
              ) : (
                <>
                  <Button
                    variant="primary"
                    onPress={handleContinueToGrouping}
                    style={styles.continueButton}
                  >
                    Continue to Grouping →
                  </Button>
                  <Text variant="body" size="xs" color="muted" style={styles.helpText}>
                    Group photos into items on the next screen
                  </Text>
                </>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.xxl,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
  },
  gridContent: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
  },
  uploadZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.md,
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.xxl,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  uploadIcon: {
    width: 48,
    height: 48,
    backgroundColor: colors.accentSoft,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIconText: {
    fontSize: 24,
  },
  uploadText: {
    textAlign: 'center',
    lineHeight: (typography?.lineHeights?.relaxed || 1.5) * (typography?.sizes?.lg || 15),
  },
  libraryButton: {
    marginTop: spacing.md,
    minWidth: 200,
  },
  photoCountHeader: {
    marginBottom: spacing.lg,
    marginTop: spacing.md,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    marginBottom: spacing.xl,
  },
  photoItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.accentSoft,
  },
  removeOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  photoNumber: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoNumberText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  addMoreButton: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addMoreIcon: {
    fontSize: 32,
    color: colors.textSecondary,
    fontWeight: '300',
  },
  takePhotoButton: {
    marginBottom: spacing.xl,
  },
  actionButtons: {
    marginTop: 'auto',
    paddingBottom: spacing.xxl,
  },
  continueButton: {
    marginBottom: spacing.sm,
  },
  helpText: {
    textAlign: 'center',
  },
});
