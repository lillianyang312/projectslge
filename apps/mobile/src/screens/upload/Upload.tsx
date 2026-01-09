import React from 'react';
import { View, StyleSheet, SafeAreaView, Pressable, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { UploadStackParamList } from '../../navigation/types';
import { Text, Button } from '../../ui/components';
import { colors, spacing, radius, typography } from '../../ui/tokens';
import { useItemsStore } from '../../state/itemsStore';

type Props = NativeStackScreenProps<UploadStackParamList, 'Upload'>;

export default function UploadScreen({ navigation }: Props) {
  const setDraftFromImage = useItemsStore((state) => state.setDraftFromImage);

  const pickImage = async () => {
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
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setDraftFromImage(result.assets[0].uri);
      navigation.navigate('ConfirmAddToList');
    }
  };

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
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setDraftFromImage(result.assets[0].uri);
      navigation.navigate('ConfirmAddToList');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text size="xxxl">←</Text>
          </Pressable>
          <Text variant="headingMedium" size="heading3">
            Upload
          </Text>
        </View>

        <Pressable style={styles.uploadZone} onPress={pickImage}>
          <View style={styles.uploadIcon}>
            <Text style={styles.uploadIconText}>📸</Text>
          </View>
          <Text variant="body" size="lg" color="secondary">
            Tap to select photo
          </Text>
        </Pressable>

        <Button variant="primary" onPress={pickImage}>
          Choose from library
        </Button>

        <Button variant="secondary" onPress={takePhoto} style={styles.cameraBtn}>
          Take photo
        </Button>

        <Text
          variant="body"
          size="base"
          color="muted"
          style={styles.hint}
        >
          Take a clear photo of the item you want to add to your list
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xxl,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.md,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.xxl,
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
  cameraBtn: {
    marginTop: spacing.md,
  },
  hint: {
    textAlign: 'center',
    marginTop: spacing.xl,
    lineHeight: typography.lineHeights.relaxed * typography.sizes.base,
  },
});
