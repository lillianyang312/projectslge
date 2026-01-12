import React from 'react';
import { View, StyleSheet, SafeAreaView, Pressable, Alert, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { ListStackParamList } from '../../navigation/types';
import { Text, Button, Header } from '../../ui/components';
import { colors, spacing, radius, typography } from '../../ui/tokens';
import { useItemsStore } from '../../state/itemsStore';

type Props = NativeStackScreenProps<ListStackParamList, 'Upload'>;

export default function UploadScreen({ navigation }: Props) {
  const setDraftFromImage = useItemsStore((state) => state.setDraftFromImage);
  const updateDraft = useItemsStore((state) => state.updateDraft);
  const draft = useItemsStore((state) => state.draft);

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
      const existingUris = draft?.imageUris || [];

      // Add new photo to existing photos (max 5)
      const updatedUris = [...existingUris, newUri].slice(0, 5);

      if (existingUris.length === 0) {
        // First photo - set as primary
        setDraftFromImage(newUri);
      }

      updateDraft({ imageUris: updatedUris });

      // Ask if user wants to take more photos or continue
      if (updatedUris.length < 5) {
        Alert.alert(
          'Photo added',
          `${updatedUris.length}/5 photos. Take another photo or continue to details?`,
          [
            { text: 'Take another', onPress: takePhoto },
            { text: 'Continue', onPress: () => navigation.navigate('ItemDetails') },
          ]
        );
      } else {
        Alert.alert('Maximum photos reached', 'You can add up to 5 photos per item.');
        navigation.navigate('ItemDetails');
      }
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
      allowsEditing: false, // Allow multiple selection without cropping
      allowsMultipleSelection: true, // Enable multiple photo selection
      quality: 0.8,
      selectionLimit: 5, // Limit to 5 photos
    });

    if (!result.canceled && result.assets.length > 0) {
      // Get all selected image URIs
      const imageUris = result.assets.map(asset => asset.uri);

      // Set the first image as the primary image and store all images
      setDraftFromImage(imageUris[0]);
      updateDraft({ imageUris });

      navigation.navigate('ItemDetails');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Header title="Upload" showBack={true} style={styles.header} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Pressable style={styles.uploadZone} onPress={takePhoto}>
            <View style={styles.uploadIcon}>
              <Text style={styles.uploadIconText}>📸</Text>
            </View>
            <Text variant="body" size="lg" color="secondary" style={styles.uploadText}>
              Take a clear photo of the item you want to list
            </Text>
          </Pressable>

          <Button variant="primary" onPress={pickFromLibrary}>
            Choose from library
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
    width: 80,
    height: 80,
    backgroundColor: colors.accentSoft,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIconText: {
    fontSize: 40,
  },
  uploadText: {
    textAlign: 'center',
    lineHeight: (typography?.lineHeights?.relaxed || 1.5) * (typography?.sizes?.lg || 15),
  },
});
