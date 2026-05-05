import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { AppProvider, useApp } from "@/contexts/AppContext";
import { NitroProvider } from "@/contexts/NitroContext";
import { client, account } from "@/lib/appwrite-client";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from "@expo-google-fonts/poppins";
import { Colors } from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useApp();
  if (!isLoggedIn) {
    return <Redirect href="/auth/login" />;
  }
  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="auth/login" options={{ animation: "fade" }} />
      <Stack.Screen name="auth/register" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="tools/ai-voice-assistant" />
      <Stack.Screen name="tools/age-calculator" />
      <Stack.Screen name="tools/ai-code-helper" />
      <Stack.Screen name="tools/ai-image-generator" />
      <Stack.Screen name="tools/ai-image-prompt" />
      <Stack.Screen name="tools/ai-story-writer" />
      <Stack.Screen name="tools/bio-generator" />
      <Stack.Screen name="tools/bmi-calculator" />
      <Stack.Screen name="tools/code-notes" />
      <Stack.Screen name="tools/currency-converter" />
      <Stack.Screen name="tools/flashcard" />
      <Stack.Screen name="tools/loan-calculator" />
      <Stack.Screen name="tools/music-player" />
      <Stack.Screen name="tools/notes" />
      <Stack.Screen name="tools/password-generator" />
      <Stack.Screen name="tools/photo-editor" />
      <Stack.Screen name="tools/pymate" />
      <Stack.Screen name="tools/qr-tool" />
      <Stack.Screen name="tools/settings" />
      <Stack.Screen name="tools/thumbnail-ideas" />
      <Stack.Screen name="tools/tip-calculator" />
      <Stack.Screen name="tools/translator" />
      <Stack.Screen name="tools/trip-planner" />
      <Stack.Screen name="tools/unit-converter" />
      <Stack.Screen name="tools/video-downloader" />
      <Stack.Screen name="tools/video-player" />
      <Stack.Screen name="tools/voice-memo" />
      <Stack.Screen name="tools/world-clock" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    // Verify Appwrite backend connectivity on app start
    account.get().then(() => {
      console.log("[Appwrite] Connected — active session found");
    }).catch((err: unknown) => {
      // 401 = no active session (expected when logged out), anything else is a real error
      const code = (err as any)?.code;
      if (code === 401) {
        console.log("[Appwrite] Connected — no active session (user logged out)");
      } else {
        console.warn("[Appwrite] Connectivity check:", err);
      }
    });
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <NitroProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </NitroProvider>
        </AppProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
