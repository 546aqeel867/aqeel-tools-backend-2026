import { Tabs } from "expo-router";
import { Platform, Animated, View, StyleSheet } from "react-native";
import React, { useRef, useEffect } from "react";
import { Colors } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ZenoTabIcon } from "@/components/ZenoLogo";

type TabConfig = {
  name: string;
  label: string;
  icon: (color: string, size: number) => React.ReactNode;
  activeColor: string;
};

const TABS: TabConfig[] = [
  {
    name: "index",
    label: "Tools",
    icon: (color, size) => <Ionicons name="grid" size={size} color={color} />,
    activeColor: Colors.primary,
  },
  {
    name: "games",
    label: "Games",
    icon: (color, size) => <Ionicons name="game-controller" size={size} color={color} />,
    activeColor: "#F59E0B",
  },
  {
    name: "chat",
    label: "Zeno",
    icon: (color, size) => <ZenoTabIcon size={size + 2} focused={color === "#7C3AED"} />,
    activeColor: "#7C3AED",
  },
  {
    name: "profile",
    label: "Profile",
    icon: (color, size) => <Ionicons name="person-circle" size={size} color={color} />,
    activeColor: "#059669",
  },
];

function AnimatedTabIcon({ focused, config }: { focused: boolean; config: TabConfig }) {
  const scale = useRef(new Animated.Value(focused ? 1 : 0.88)).current;
  const dotOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const dotScale = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const bgOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    if (focused) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1.18, tension: 220, friction: 8, useNativeDriver: true }),
        Animated.timing(dotOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(dotScale, { toValue: 1, tension: 240, friction: 9, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        Animated.spring(scale, { toValue: 1, tension: 160, friction: 8, useNativeDriver: true }).start();
      });
    } else {
      Animated.parallel([
        Animated.spring(scale, { toValue: 0.88, tension: 200, friction: 10, useNativeDriver: true }),
        Animated.timing(dotOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.spring(dotScale, { toValue: 0, tension: 200, friction: 10, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]).start();
    }
  }, [focused]);

  const color = focused ? config.activeColor : Colors.textMuted;

  return (
    <View style={t.iconContainer}>
      <Animated.View
        style={[
          t.iconBg,
          {
            backgroundColor: config.activeColor + "1A",
            opacity: bgOpacity,
            transform: [{ scale: bgOpacity.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
          },
        ]}
      />
      <Animated.View style={{ transform: [{ scale }] }}>
        {config.icon(color, 22)}
      </Animated.View>
      <Animated.View
        style={[t.dot, { backgroundColor: config.activeColor, opacity: dotOpacity, transform: [{ scale: dotScale }] }]}
      />
    </View>
  );
}

const t = StyleSheet.create({
  iconContainer: { alignItems: "center", justifyContent: "center", width: 52, height: 36, position: "relative" },
  iconBg: { position: "absolute", width: 46, height: 30, borderRadius: 12 },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 4 },
});

export default function TabLayout() {
  const isWeb = Platform.OS === "web";
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 0.5,
          borderTopColor: "rgba(0,0,0,0.06)",
          elevation: 0,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
          height: isWeb ? 84 : 58 + (insets.bottom > 0 ? insets.bottom : 8),
          paddingBottom: isWeb ? 34 : insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: "Poppins_600SemiBold",
          fontSize: 10,
          letterSpacing: 0.1,
          marginTop: 0,
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarActiveTintColor: tab.activeColor,
            tabBarIcon: ({ focused }) => (
              <AnimatedTabIcon focused={focused} config={tab} />
            ),
          }}
        />
      ))}
      {/* Nitro screen: still a route, hidden from tab bar */}
      <Tabs.Screen name="nitro" options={{ href: null }} />
    </Tabs>
  );
}
