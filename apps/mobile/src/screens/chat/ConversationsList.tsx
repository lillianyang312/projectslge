import React from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';
import { Text, Card, Header } from '../../ui/components';
import { colors, spacing, radius } from '../../ui/tokens';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Conversations'>;

// Demo conversations matching HTML spec
const demoConversations = [
  {
    id: 'conv-1',
    emoji: '🪑',
    name: 'Herman Miller Aeron',
    preview: 'Saturday works! Can we do closer to 3pm?',
    time: '2:47 PM',
    hasUnread: true,
  },
  {
    id: 'conv-2',
    emoji: '🖥️',
    name: 'Apple Studio Display',
    preview: 'Agent: Shipping label has been created',
    time: 'Yesterday',
    hasUnread: false,
  },
  {
    id: 'conv-3',
    emoji: '🎸',
    name: 'Fender Stratocaster',
    preview: 'Thanks! Great doing business',
    time: 'Jan 5',
    hasUnread: false,
  },
];

export default function ConversationsListScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.headerContainer}>
        <Header title="Messages" onBack={() => navigation.goBack()} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {demoConversations.map((convo) => (
          <Pressable
            key={convo.id}
            onPress={() => navigation.navigate('ChatThread', { conversationId: convo.id })}
          >
            <Card style={styles.convoCard}>
              <View style={styles.convoContent}>
                <View style={styles.convoAvatar}>
                  <Text style={styles.avatarEmoji}>{convo.emoji}</Text>
                </View>
                <View style={styles.convoInfo}>
                  <Text variant="bodyMedium" size="lg" style={styles.convoName}>
                    {convo.name}
                  </Text>
                  <Text
                    variant="body"
                    size="sm"
                    color="secondary"
                    style={styles.convoPreview}
                    numberOfLines={1}
                  >
                    {convo.preview}
                  </Text>
                </View>
                <View style={styles.convoMeta}>
                  <Text variant="body" size="xs" color="muted">
                    {convo.time}
                  </Text>
                  {convo.hasUnread && <View style={styles.unreadBadge} />}
                </View>
              </View>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  headerContainer: {
    paddingHorizontal: spacing.xxl,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  convoCard: {
    marginBottom: spacing.md,
  },
  convoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  convoAvatar: {
    width: 48,
    height: 48,
    backgroundColor: colors.accentSoft,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 20,
  },
  convoInfo: {
    flex: 1,
  },
  convoName: {
    marginBottom: 2,
  },
  convoPreview: {
    maxWidth: 200,
  },
  convoMeta: {
    alignItems: 'flex-end',
  },
  unreadBadge: {
    width: 8,
    height: 8,
    backgroundColor: colors.purple,
    borderRadius: 4,
    marginTop: spacing.xs,
  },
});

