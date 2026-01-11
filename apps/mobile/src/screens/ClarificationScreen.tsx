import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme/tokens';
import { ListStackParamList } from '../navigation/types';
import { getDemoDrafts } from '../state/itemsStore';
import {
  getConfidenceScoreColor,
  getConfidenceLabel,
} from '../state/confidenceUtils';
import {
  isIdentifiedResponse,
  isNeedsClarificationResponse,
  getResponseConfidenceLevel,
} from '../schemas/clarification_schema';

type Props = NativeStackScreenProps<ListStackParamList, 'Clarification'>;

export default function ClarificationScreen({ navigation }: Props) {
  const demoDrafts = getDemoDrafts();

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Clarification Examples</Text>
        <Text style={styles.subtitle}>Demo listings with different confidence levels</Text>

        {demoDrafts.map((draft, index) => {
          if (!draft.clarificationResponse) return null;

          const response = draft.clarificationResponse;
          const confidenceLevel = getResponseConfidenceLevel(response);
          const confidenceColor = getConfidenceScoreColor(response.confidence);
          const confidenceLabel = getConfidenceLabel(confidenceLevel);

          return (
            <View key={index} style={styles.demoCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{draft.title || 'Untitled Item'}</Text>
                <View
                  style={[
                    styles.confidenceBadge,
                    { backgroundColor: confidenceColor },
                  ]}
                >
                  <Text style={styles.confidenceText}>{confidenceLabel}</Text>
                </View>
              </View>

              {isIdentifiedResponse(response) && (
                <View style={styles.responseContent}>
                  <Text style={styles.responseLabel}>Identified Item:</Text>
                  <Text style={styles.responseText}>{response.item.title}</Text>
                  <Text style={styles.responseText}>{response.item.category}</Text>
                  <Text style={styles.confidenceScore}>
                    Confidence: {(response.confidence * 100).toFixed(0)}%
                  </Text>
                </View>
              )}

              {isNeedsClarificationResponse(response) && (
                <View style={styles.responseContent}>
                  <Text style={styles.responseLabel}>Question:</Text>
                  <Text style={styles.questionText}>{response.question}</Text>
                  {response.options.length > 0 ? (
                    <View style={styles.optionsContainer}>
                      <Text style={styles.optionsLabel}>Options:</Text>
                      {response.options.map((option) => (
                        <View key={option.id} style={styles.optionItem}>
                          <Text style={styles.optionLabel}>{option.label}</Text>
                          <Text style={styles.optionDescriptor}>{option.descriptor}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.noOptionsText}>No options - requires user input</Text>
                  )}
                  <Text style={styles.confidenceScore}>
                    Confidence: {(response.confidence * 100).toFixed(0)}%
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        <Pressable
          style={styles.button}
          onPress={() => navigation.navigate('ConfirmAddToList')}
        >
          <Text style={styles.buttonText}>Confirm & Add to List →</Text>
        </Pressable>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
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
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  demoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  confidenceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  responseContent: {
    marginTop: 8,
  },
  responseLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  responseText: {
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  questionText: {
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  optionsContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  optionsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  optionItem: {
    backgroundColor: colors.accentSoft,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  optionDescriptor: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  noOptionsText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  confidenceScore: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.accent,
    borderRadius: 8,
    marginBottom: 16,
    marginTop: 8,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    color: colors.accent,
  },
});
