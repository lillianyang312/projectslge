import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, Pressable, Image } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { UploadStackParamList } from '../../navigation/types';
import { Text, Button, Card } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';
import { useItemsStore } from '../../state/itemsStore';

type Props = NativeStackScreenProps<UploadStackParamList, 'Clarification'>;

export default function ClarificationScreen({ navigation, route }: Props) {
  const { imageUri, imagePath, question, options, originalLabel, confidence } = route.params;
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const updateDraft = useItemsStore((state) => state.updateDraft);

  const handleConfirm = () => {
    if (!selectedOption) return;

    const selected = options.find((opt) => opt.id === selectedOption);
    if (!selected) return;

    // Update draft with the clarified category
    updateDraft({
      category: selected.label,
      // Set confidence to 0.9 after user confirmation
      // (This is documented as a design choice: user confirmation implies high confidence)
    });

    // Navigate to confirm screen
    navigation.navigate('ConfirmAddToList');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text size="xxxl">←</Text>
          </Pressable>
          <Text variant="headingMedium" size="heading3">
            Need a little help
          </Text>
        </View>

        {/* Image Preview */}
        {imageUri && (
          <Card style={styles.imageCard}>
            <Image source={{ uri: imageUri }} style={styles.image} />
          </Card>
        )}

        {/* Clarification Card */}
        <Card style={styles.clarificationCard}>
          <Text variant="bodyMedium" size="md" style={styles.question}>
            {question}
          </Text>

          <Text variant="body" size="sm" color="muted" style={styles.hint}>
            Select the category that best describes your item:
          </Text>

          {/* Pills / Options */}
          <View style={styles.optionsContainer}>
            {options.map((option) => (
              <Pressable
                key={option.id}
                style={[
                  styles.pill,
                  selectedOption === option.id && styles.pillActive,
                ]}
                onPress={() => setSelectedOption(option.id)}
              >
                <Text
                  variant="bodyMedium"
                  size="md"
                  color={selectedOption === option.id ? 'white' : 'primary'}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Confidence Info */}
        <View style={styles.infoBox}>
          <Text variant="body" size="sm" color="secondary">
            Our AI was {Math.round(confidence * 100)}% confident this is {originalLabel}.
            Your feedback helps us improve!
          </Text>
        </View>

        <Button
          variant="primary"
          onPress={handleConfirm}
          disabled={!selectedOption}
          style={styles.confirmBtn}
        >
          Confirm
        </Button>

        <Button
          variant="secondary"
          onPress={() => navigation.goBack()}
          style={styles.cancelBtn}
        >
          Go back
        </Button>
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
  imageCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.accentSoft,
  },
  clarificationCard: {
    backgroundColor: colors.warningSoft,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
    marginBottom: spacing.lg,
  },
  question: {
    marginBottom: spacing.md,
  },
  hint: {
    marginBottom: spacing.lg,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  pillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  infoBox: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  confirmBtn: {
    marginBottom: spacing.md,
  },
  cancelBtn: {
    marginBottom: spacing.md,
  },
});
