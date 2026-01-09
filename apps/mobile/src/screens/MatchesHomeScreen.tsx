import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme/tokens';
import { MatchesStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<MatchesStackParamList, 'MatchesHome'>;

export default function MatchesHomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.title}>Matches</Text>
        <Pressable
          style={styles.button}
          onPress={() => navigation.navigate('MatchDetail', { matchId: 'match-123' })}
        >
          <Text style={styles.buttonText}>View Match Detail →</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 24,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.accent,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
});
