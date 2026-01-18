import React from 'react';
import { View, TextInput, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Text } from './Text';
import { colors, radius, spacing, typography } from '../tokens';
import { CustomQuestion } from '../../state/itemsStore';

interface QuestionInputProps {
  question: CustomQuestion;
  value?: string;
  onChange: (answer: string) => void;
  style?: ViewStyle;
}

export function QuestionInput({ question, value, onChange, style }: QuestionInputProps) {
  const isSelect = question.inputType === 'select' && question.options && question.options.length > 0;

  return (
    <View style={[styles.container, style]}>
      <Text variant="bodyMedium" size="sm" style={styles.questionText}>
        {question.question}
      </Text>

      {isSelect ? (
        <View style={styles.optionsContainer}>
          {question.options!.map((option, index) => (
            <Pressable
              key={index}
              style={[
                styles.optionPill,
                value === option && styles.optionPillSelected,
              ]}
              onPress={() => onChange(option)}
            >
              <Text
                variant="body"
                size="sm"
                color={value === option ? 'white' : 'primary'}
              >
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <TextInput
          style={styles.textInput}
          value={value || ''}
          onChangeText={onChange}
          placeholder={question.placeholder || 'Enter your answer'}
          placeholderTextColor={colors.textMuted}
          multiline={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  questionText: {
    marginBottom: spacing.sm,
    color: colors.textPrimary,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionPill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
  },
  optionPillSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  textInput: {
    width: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    fontSize: typography?.sizes?.sm || 14,
    fontFamily: typography?.fonts?.body || 'DMSans_400Regular',
    color: colors.textPrimary,
    backgroundColor: colors.card,
  },
});
