# projectslge

Monorepo for the Passive Shopping project.

## Structure

- `apps/mobile` - Expo + React Native mobile app
- `passive-marketplace/` - Next.js web marketplace
- `lge-leads-backend/` - Next.js backend API

## Mobile App Setup

### Prerequisites

- Node.js (v18 or later)
- npm or yarn
- iOS Simulator (for Mac development)
- Expo CLI (installed globally or via npx)

### Installation

1. Navigate to the mobile app directory:
   ```bash
   cd apps/mobile
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running the App

Start the Expo development server:
```bash
npx expo start
```

Then:
- Press `i` to open iOS simulator (Mac only)
- Press `a` to open Android emulator
- Scan the QR code with Expo Go app on your physical device

### Development

The app uses:
- **Expo** - React Native framework
- **React Navigation** - Navigation library
- **TypeScript** - Type safety

#### Project Structure

```
apps/mobile/
├── src/
│   ├── screens/      # Screen components
│   ├── components/   # Reusable components
│   ├── navigation/   # Navigation setup
│   ├── lib/          # Utilities and helpers
│   └── types/        # TypeScript type definitions
├── App.tsx           # Root component
└── package.json
```

### Environment Variables

The mobile app requires Supabase configuration. Copy the template and fill in your values:

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Then add your Supabase project credentials to `apps/mobile/.env`:
- `EXPO_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key

**Note:** These are prefixed with `EXPO_PUBLIC_` so they are safe to expose in the client.

### Troubleshooting

- If you encounter issues, try clearing the cache:
  ```bash
  npx expo start --clear
  ```

- Make sure you're using Node.js v18 or later

