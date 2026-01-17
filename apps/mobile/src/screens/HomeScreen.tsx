import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, radii } from '../theme/tokens';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.homeContent}>
        {/* Logo: 14px, muted, letterSpacing 0.5, marginBottom 48 */}
        <Text style={styles.homeLogo}>passive</Text>

        {/* Headline: 36px, lineHeight ~41 (1.15), marginBottom 16 */}
        <Text style={styles.homeHeadline}>
          Passive{'\n'}shopping
        </Text>

        {/* Subtext: 16px, lineHeight 24, secondary color, marginBottom 48 */}
        <Text style={styles.homeSubtext}>
          List what you own. Share what you want. We'll handle the rest.
        </Text>

        {/* Buttons: column, gap 12 */}
        <View style={styles.homeButtons}>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => navigation.navigate('Upload')}
            activeOpacity={0.8}
          >
            <Text style={[styles.btnText, styles.btnPrimaryText]}>
              Upload an item
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => navigation.navigate('SwipeBuy')}
            activeOpacity={0.8}
          >
            <Text style={[styles.btnText, styles.btnSecondaryText]}>
              Swipe nearby
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  homeContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  homeLogo: {
    fontFamily: 'System',
    fontSize: 14,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 48,
  },
  homeHeadline: {
    fontFamily: 'System',
    fontSize: 36,
    lineHeight: 41,
    color: colors.textPrimary,
    fontWeight: '500',
    marginBottom: 16,
  },
  homeSubtext: {
    fontFamily: 'System',
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
    marginBottom: 48,
  },
  homeButtons: {
    // gap: 12 (use margin instead for compatibility)
  },
  btn: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: radii.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '500',
  },
  btnPrimary: {
    backgroundColor: colors.accent,
    marginBottom: 12,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnSecondaryText: {
    color: colors.textPrimary,
  },
});

