# Navigation Setup

This app uses **React Navigation** (Expo Go compatible) with a single `NavigationContainer` and a native stack navigator.

## Architecture

```
src/
├── navigation/
│   └── AppNavigator.tsx     # Main navigator with all routes
├── screens/                 # All screen components
│   ├── WelcomeScreen.tsx
│   ├── SignupScreen.tsx
│   └── ...
└── theme/
    └── tokens.ts            # Design tokens (colors, radii, etc.)
```

## Current Routes

All routes are defined in `src/navigation/AppNavigator.tsx`:

- **Auth Flow**: Welcome, Signup, Login, ResetPassword, ResetSent
- **Main App**: Home, Upload, UploadClarify, MyList, ItemDetail
- **Wants**: MyWants, AddWant
- **Swipe**: SwipeBuy, SwipeSell
- **Matching**: Matches, Agent, Offer
- **Logistics**: PickupDetails, Shipping
- **Communication**: Conversations, Chat
- **Other**: Deals, Profile

## How to Add a New Route

Follow these steps to safely add a new screen and route:

### 1. Create the Screen Component

Create a new file in `src/screens/YourScreen.tsx`:

```tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme/tokens';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'YourRoute'>;

export default function YourScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.title}>Your Screen</Text>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
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
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.accent,
  },
});
```

### 2. Update RootStackParamList

In `src/navigation/AppNavigator.tsx`, add your route to the type definition:

```tsx
export type RootStackParamList = {
  // ... existing routes
  YourRoute: undefined; // or { yourParam: string } if you need params
};
```

### 3. Import the Screen

At the top of `src/navigation/AppNavigator.tsx`:

```tsx
import YourScreen from '../screens/YourScreen';
```

### 4. Add Stack.Screen

Inside the `<Stack.Navigator>` in `AppNavigator`:

```tsx
<Stack.Screen name="YourRoute" component={YourScreen} />
```

### 5. Navigate to It

From any other screen:

```tsx
navigation.navigate('YourRoute');
```

Or with params (if defined):

```tsx
navigation.navigate('YourRoute', { yourParam: 'value' });
```

## Important Notes

### Navigation Best Practices

- ✅ **DO** use `@react-navigation/native` and `@react-navigation/native-stack`
- ✅ **DO** keep ONE `NavigationContainer` (in AppNavigator)
- ✅ **DO** use `NativeStackScreenProps` for type safety
- ✅ **DO** hide headers globally (`headerShown: false`) to maintain custom design
- ❌ **DON'T** import from `react-native-screens` directly
- ❌ **DON'T** use `<Screen/>` - always use `<Stack.Screen/>`
- ❌ **DON'T** use native-only packages (e.g., `react-native-bottom-tabs`)

### Expo Go Compatibility

This navigation setup is **100% Expo Go compatible**. It uses only:
- `@react-navigation/native`
- `@react-navigation/native-stack`
- `react-native-screens` (Expo-managed)
- `react-native-safe-area-context` (Expo-managed)

No custom native modules or development builds required.

## Running the App

```bash
# Clear cache and start
npx expo start -c

# Or just start
npx expo start
```

Scan the QR code with:
- **iOS**: Camera app
- **Android**: Expo Go app

## Troubleshooting

### TypeScript Errors with React 19

If you see type errors about missing `id` prop on `Stack.Navigator`, add the `id` prop:

```tsx
<Stack.Navigator id="root" initialRouteName="Welcome">
```

This is already configured in `AppNavigator.tsx`.

### Port Already in Use

```bash
lsof -ti:8081 | xargs kill -9
```

### Cache Issues

```bash
npx expo start -c
```

Or manually clear:
```bash
rm -rf node_modules/.cache
watchman shutdown-server  # if installed
```
