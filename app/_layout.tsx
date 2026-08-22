import { ActivityIndicator, View } from "react-native";
import { Stack, router } from "expo-router";
import { useEffect } from "react";
import { SubjectsProvider } from "../context/SubjectsContext";
import { AuthProvider, useAuth } from "../context/AuthContext";

function RootLayoutContent() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        // User exists in storage, route directly home
        router.replace("/(tabs)/home");
      } else {
        // No user, make sure we go to login
        router.replace("/");
      }
    }
  }, [isLoading, user]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8F9FA" }}>
        <ActivityIndicator size="large" color="#12B3C9" />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="subject/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="topic/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="quiz/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="enhance/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <SubjectsProvider>
        <RootLayoutContent />
      </SubjectsProvider>
    </AuthProvider>
  );
}
