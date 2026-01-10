import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, Pressable, Image, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { UploadStackParamList } from '../../navigation/types';
import { Text, Button, Input, Card } from '../../ui/components';
import { colors, spacing, radius, typography } from '../../ui/tokens';
import { useItemsStore } from '../../state/itemsStore';

type Props = NativeStackScreenProps<UploadStackParamList, 'ConfirmAddToList'>;

export default function ConfirmAddToListScreen({ navigation }: Props) {
  const draft = useItemsStore((state) => state.draft);
  const updateDraft = useItemsStore((state) => state.updateDraft);
  const commitDraft = useItemsStore((state) => state.commitDraft);

  const [title, setTitle] = useState(draft?.title || '');
  const [category, setCategory] = useState(draft?.category || '');
  const [notes, setNotes] = useState(draft?.notes || '');
  const [selectedIntent, setSelectedIntent] = useState<'owned' | 'wants'>(
    draft?.intent || 'owned'
  );

  const handleAddToList = () => {
    updateDraft({
      title,
      category,
      description: notes || title, // Use notes as description, fallback to title
      notes,
      intent: selectedIntent,
    });
    
    // TODO: Get actual seller ID from auth store
    const result = commitDraft('current-user');
    
    if (!result.success) {
      Alert.alert(
        'Error',
        result.error.getFirstError() || 'Failed to create listing'
      );
      return;
    }

    // Navigate back to Home tab and then to MyList
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate('Home' as never);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text size="xxxl">←</Text>
          </Pressable>
          <Text variant="headingMedium" size="heading3">
            Confirm details
          </Text>
        </View>

        {/* Image Preview */}
        {draft?.imageUri && (
          <Card style={styles.imageCard}>
            <Image source={{ uri: draft.imageUri }} style={styles.image} />
          </Card>
        )}

        {/* Intent Toggle */}
        <View style={styles.section}>
          <Text variant="body" size="base" color="secondary" style={styles.label}>
            I want to...
          </Text>
          <View style={styles.intentToggle}>
            <Pressable
              style={[
                styles.intentBtn,
                selectedIntent === 'owned' && styles.intentBtnActive,
              ]}
              onPress={() => setSelectedIntent('owned')}
            >
              <Text
                variant="bodyMedium"
                size="md"
                color={selectedIntent === 'owned' ? 'white' : 'primary'}
              >
                Add to My List
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.intentBtn,
                selectedIntent === 'wants' && styles.intentBtnActive,
              ]}
              onPress={() => setSelectedIntent('wants')}
            >
              <Text
                variant="bodyMedium"
                size="md"
                color={selectedIntent === 'wants' ? 'white' : 'primary'}
              >
                Add to Wants
              </Text>
            </Pressable>
          </View>
        </View>

        <Input
          label="Item name"
          placeholder="What is this item?"
          value={title}
          onChangeText={setTitle}
        />

        <Input
          label="Category"
          placeholder="e.g. Furniture, Electronics, etc."
          value={category}
          onChangeText={setCategory}
        />

        <Input
          label="Notes (optional)"
          placeholder="Anything else about this item..."
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />

        <Button
          variant="primary"
          onPress={handleAddToList}
          disabled={!title || !category}
        >
          {selectedIntent === 'owned' ? 'Add to My List' : 'Add to Wants'}
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
  scroll: {
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
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.accentSoft,
  },
  section: {
    marginBottom: spacing.xl,
  },
  label: {
    marginBottom: 6,
  },
  intentToggle: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  intentBtn: {
    flex: 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  intentBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
});
