import React, { useRef, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
  Animated, Alert, Easing, TextInput, ActivityIndicator, KeyboardAvoidingView, useWindowDimensions,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useNitro, NITRO_FEATURES } from "@/contexts/NitroContext";
import { Colors } from "@/constants/colors";

const GOLD = "#F59E0B";
const NITRO_PURPLE = "#5865F2";
const NITRO_DARK = "#09090F";
const CARD_BG = "rgba(255,255,255,0.05)";
const CARD_BORDER = "rgba(255,255,255,0.10)";
const BAT_ORANGE = "#FF6B00";
const TEXT_DIM = "rgba(255,255,255,0.55)";
const TEXT_BRIGHT = "rgba(255,255,255,0.95)";

type Period = "month" | "year";

const PLANS = [
  {
    id: "nitro",
    name: "Nitro",
    emoji: "⚡",
    color: NITRO_PURPLE,
    badge: null,
    monthPrice: "$2.99",
    yearPrice: "$24.99",
    yearMonthly: "$2.08",
    yearSaving: "Save 30%",
    features: ["10 AI tools unlocked", "Ad-free experience", "Priority AI responses", "Exclusive Nitro theme"],
  },
  {
    id: "nitro_bat",
    name: "Nitro Bat",
    emoji: "🦇",
    color: BAT_ORANGE,
    badge: "BEST VALUE",
    monthPrice: "$4.99",
    yearPrice: "$39.99",
    yearMonthly: "$3.33",
    yearSaving: "Save 33%",
    features: ["ALL 40+ tools unlocked", "Ad-free + 5 exclusive themes", "Fastest AI (GPT-4 level)", "PyMate Pro access", "Early access to new tools", "Bat badge on profile"],
  },
];

const COMPARE_ROWS = [
  { label: "Tools",       free: "25+ free",     nitro: "All 40+ tools" },
  { label: "AI Requests", free: "5 / day",       nitro: "Unlimited" },
  { label: "Ads",         free: "Yes",           nitro: "None ✨" },
  { label: "AI Quality",  free: "Basic",         nitro: "GPT-4 level" },
  { label: "PyMate",      free: "Locked 🔒",     nitro: "Full access 🐍" },
  { label: "Themes",      free: "1 theme",       nitro: "5 themes 🎨" },
  { label: "Support",     free: "Standard",      nitro: "Priority 🚀" },
  { label: "New Tools",   free: "After 30 days", nitro: "Day 1 access 🦇" },
];

function SectionCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[card.wrap, style]}>
      {children}
    </View>
  );
}

const card = StyleSheet.create({
  wrap: { backgroundColor: CARD_BG, borderRadius: 20, borderWidth: 1, borderColor: CARD_BORDER, overflow: "hidden" },
});

export default function NitroScreen() {
  const { width: SW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const {
    isNitro, plan, expiresAt, demoActivated, billingPeriod, promoCode,
    activateDemo, activatePlan, activatePromo, deactivate, daysLeft,
  } = useNitro();

  const [period, setPeriod] = useState<Period>("month");
  const [promoInput, setPromoInput] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoMsg, setPromoMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const glowAnim = useRef(new Animated.Value(0)).current;
  const batAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const toggleAnim = useRef(new Animated.Value(0)).current;
  const enterAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enterAnim, { toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(batAnim, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(batAnim, { toValue: 0, duration: 2800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.spring(pulseAnim, { toValue: 1.07, tension: 90, friction: 5, useNativeDriver: true }),
        Animated.spring(pulseAnim, { toValue: 1, tension: 90, friction: 5, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.75] });
  const batY = batAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const enterY = enterAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  const switchPeriod = (p: Period) => {
    Haptics.selectionAsync();
    setPeriod(p);
    Animated.spring(toggleAnim, { toValue: p === "year" ? 1 : 0, tension: 220, friction: 16, useNativeDriver: true }).start();
    setPromoMsg(null);
  };

  const handleActivateDemo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      "🦇 Start Free Trial",
      "Get 7 days of Nitro Bat completely free. No credit card required.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Start Free Trial", onPress: async () => {
          await activateDemo();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }},
      ]
    );
  };

  const handlePlanPress = (planId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const planType = planId === "nitro_bat" ? "nitro_bat" : "nitro";
    Alert.alert(
      `Get ${planId === "nitro_bat" ? "🦇 Nitro Bat" : "⚡ Nitro"}`,
      `In the full release, this activates a real ${period === "year" ? "yearly" : "monthly"} subscription.\n\nFor now, starting your 7-day free trial instead.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Start 7-Day Free Trial", onPress: async () => {
          await activatePlan(planType, period);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }},
      ]
    );
  };

  const handleApplyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPromoLoading(true);
    setPromoMsg(null);
    const result = await activatePromo(code);
    setPromoLoading(false);
    setPromoMsg({ text: result.message, ok: result.success });
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPromoInput("");
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleDeactivate = () => {
    Alert.alert("Deactivate Nitro", "This will return you to the free plan.", [
      { text: "Cancel", style: "cancel" },
      { text: "Deactivate", style: "destructive", onPress: deactivate },
    ]);
  };

  const planLabel = plan === "nitro_bat" ? "🦇 Nitro Bat Pro" : "⚡ Nitro Pro";
  const periodLabel = billingPeriod === "demo" ? "Free trial" : billingPeriod === "promo" ? `Promo: ${promoCode}` : billingPeriod === "year" ? "Yearly" : "Monthly";

  const toggleSlideX = toggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, (SW - 36 - 8) / 2 + 4],
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[s.container, { paddingTop: topPad }]}>
        <ScrollView
          contentContainerStyle={[s.scrollContent, { paddingBottom: bottomPad + 52 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── HERO ── */}
          <Animated.View style={[s.hero, { opacity: enterAnim, transform: [{ translateY: enterY }] }]}>
            <View style={s.heroGlowWrap} pointerEvents="none">
              <Animated.View style={[s.glow1, { opacity: glowOpacity }]} />
              <Animated.View style={[s.glow2, { opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.28] }) }]} />
            </View>

            <Animated.View style={[s.batWrap, { transform: [{ translateY: batY }, { scale: pulseAnim }] }]}>
              <View style={s.batGlowRing} />
              <Text style={s.batEmoji}>🦇</Text>
            </Animated.View>

            <Text style={s.heroTitle}>NITRO BAT</Text>

            <View style={s.heroBadgeRow}>
              <View style={[s.heroBadge, { borderColor: GOLD + "40", backgroundColor: GOLD + "15" }]}>
                <MaterialCommunityIcons name="lightning-bolt" size={11} color={GOLD} />
                <Text style={[s.heroBadgeText, { color: GOLD }]}>SUPERCHARGED</Text>
              </View>
              <View style={[s.heroBadge, { borderColor: NITRO_PURPLE + "60", backgroundColor: NITRO_PURPLE + "20" }]}>
                <Ionicons name="shield-checkmark" size={10} color={NITRO_PURPLE} />
                <Text style={[s.heroBadgeText, { color: NITRO_PURPLE }]}>PREMIUM</Text>
              </View>
            </View>

            <Text style={s.heroSub}>
              Unlock every tool, go ad-free, supercharge your AI{"\n"}starting from $2.08/mo
            </Text>

            {isNitro && (
              <View style={s.activeCard}>
                <View style={s.activeCardGlow} />
                <View style={s.activeCardLeft}>
                  <View style={s.activeIconWrap}>
                    <MaterialCommunityIcons name="crown" size={20} color={GOLD} />
                  </View>
                  <View>
                    <Text style={s.activeCardTitle}>{planLabel}</Text>
                    <Text style={s.activeCardSub}>
                      {daysLeft > 0 ? `${daysLeft} days remaining` : "Active"} · {periodLabel}
                    </Text>
                  </View>
                </View>
                <Pressable onPress={handleDeactivate} style={s.activeCardBtn}>
                  <Text style={s.activeCardBtnText}>Manage</Text>
                </Pressable>
              </View>
            )}
          </Animated.View>

          {/* ── BILLING TOGGLE ── */}
          {!isNitro && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>BILLING PERIOD</Text>
              <View style={s.toggleWrap}>
                <Animated.View style={[s.toggleSlider, { transform: [{ translateX: toggleSlideX }], width: (SW - 36 - 8) / 2 - 8 }]} />
                <Pressable style={s.toggleBtn} onPress={() => switchPeriod("month")}>
                  <Text style={[s.toggleText, period === "month" && s.toggleTextOn]}>Monthly</Text>
                </Pressable>
                <Pressable style={s.toggleBtn} onPress={() => switchPeriod("year")}>
                  <View style={s.toggleYearRow}>
                    <Text style={[s.toggleText, period === "year" && s.toggleTextOn]}>Yearly</Text>
                    <View style={s.savePill}>
                      <Text style={s.savePillText}>SAVE 30%</Text>
                    </View>
                  </View>
                </Pressable>
              </View>
            </View>
          )}

          {/* ── PLAN CARDS ── */}
          {!isNitro && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>CHOOSE YOUR PLAN</Text>
              <View style={s.plansWrap}>
                {PLANS.map((p) => (
                  <View key={p.id} style={[s.planCard, { borderColor: p.color + "45" }]}>
                    {p.badge && (
                      <View style={[s.planBadge, { backgroundColor: p.color }]}>
                        <MaterialCommunityIcons name="star" size={9} color="#fff" />
                        <Text style={s.planBadgeText}>{p.badge}</Text>
                      </View>
                    )}

                    <View style={s.planTop}>
                      <View style={[s.planIconWrap, { backgroundColor: p.color + "22" }]}>
                        <Text style={s.planEmoji}>{p.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.planName, { color: p.color }]}>{p.name}</Text>
                        <View style={s.planPriceRow}>
                          <Text style={[s.planPrice, { color: TEXT_BRIGHT }]}>
                            {period === "year" ? p.yearPrice : p.monthPrice}
                          </Text>
                          <Text style={s.planPer}>/{period === "year" ? "yr" : "mo"}</Text>
                        </View>
                        {period === "year" && (
                          <Text style={[s.planMonthly, { color: p.color }]}>{p.yearMonthly}/mo · {p.yearSaving}</Text>
                        )}
                      </View>
                    </View>

                    <View style={s.planDivider} />

                    {p.features.map((f, i) => (
                      <View key={i} style={s.planFeature}>
                        <Ionicons name="checkmark-circle" size={15} color={p.color} />
                        <Text style={s.planFeatureText}>{f}</Text>
                      </View>
                    ))}

                    <Pressable
                      onPress={() => handlePlanPress(p.id)}
                      style={({ pressed }) => [s.planBtn, { backgroundColor: p.color, opacity: pressed ? 0.86 : 1, shadowColor: p.color }]}
                    >
                      <Text style={s.planBtnEmoji}>{p.emoji}</Text>
                      <Text style={s.planBtnText}>Get {p.name}{period === "year" ? " — Yearly" : ""}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>

              <Pressable onPress={handleActivateDemo} style={s.trialRow}>
                <Ionicons name="gift-outline" size={15} color={GOLD} />
                <Text style={s.trialText}>Try FREE 7-day trial — no credit card needed</Text>
              </Pressable>
            </View>
          )}

          {/* ── PROMO CODE ── */}
          {!isNitro && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>PROMO CODE</Text>
              <SectionCard>
                <View style={s.promoInner}>
                  <View style={s.promoRow}>
                    <View style={s.promoInputWrap}>
                      <Ionicons name="ticket-outline" size={17} color="rgba(255,255,255,0.35)" style={{ marginLeft: 14 }} />
                      <TextInput
                        style={s.promoInput}
                        value={promoInput}
                        onChangeText={(t) => { setPromoInput(t.toUpperCase()); setPromoMsg(null); }}
                        placeholder="Enter code (e.g. NITRO2026)"
                        placeholderTextColor="rgba(255,255,255,0.22)"
                        autoCapitalize="characters"
                        returnKeyType="done"
                        onSubmitEditing={handleApplyPromo}
                      />
                    </View>
                    <Pressable
                      onPress={handleApplyPromo}
                      disabled={promoLoading || !promoInput.trim()}
                      style={({ pressed }) => [s.promoApplyBtn, (!promoInput.trim() || promoLoading) && { opacity: 0.45 }, pressed && { opacity: 0.8 }]}
                    >
                      {promoLoading
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={s.promoApplyText}>Apply</Text>}
                    </Pressable>
                  </View>

                  {promoMsg && (
                    <View style={[s.promoResult, {
                      backgroundColor: promoMsg.ok ? "#10B981" + "18" : "#EF4444" + "18",
                      borderColor: promoMsg.ok ? "#10B981" + "45" : "#EF4444" + "45",
                    }]}>
                      <Ionicons name={promoMsg.ok ? "checkmark-circle" : "close-circle"} size={15} color={promoMsg.ok ? "#10B981" : "#EF4444"} />
                      <Text style={[s.promoResultText, { color: promoMsg.ok ? "#10B981" : "#EF4444" }]}>{promoMsg.text}</Text>
                    </View>
                  )}

                  <Text style={s.promoHint}>Codes: NITRO2026 · AQEEL100 · TOOLS2026 · LAUNCH2026</Text>
                </View>
              </SectionCard>
            </View>
          )}

          {/* ── NITRO FEATURES ── */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>{isNitro ? "YOUR NITRO TOOLS" : "NITRO EXCLUSIVE"}</Text>
            <SectionCard>
              {NITRO_FEATURES.map((feat, i) => (
                <View key={feat.id} style={[s.nitroFeatureRow, i < NITRO_FEATURES.length - 1 && s.nitroFeatureBorder]}>
                  <View style={[s.nitroFeatureIcon, isNitro && { backgroundColor: GOLD + "18" }]}>
                    {isNitro
                      ? <Ionicons name="checkmark-circle" size={17} color={GOLD} />
                      : <Ionicons name="lock-closed" size={14} color="rgba(255,255,255,0.25)" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.nitroFeatureTitle, isNitro && { color: GOLD }]}>{feat.title}</Text>
                    <Text style={s.nitroFeatureDesc}>{feat.desc}</Text>
                  </View>
                </View>
              ))}
            </SectionCard>
          </View>

          {/* ── PYMATE SHORTCUT ── */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>FEATURED TOOL</Text>
            <Pressable
              onPress={() => router.push("/tools/pymate" as any)}
              style={({ pressed }) => [s.pymateCard, pressed && { opacity: 0.88 }]}
            >
              <View style={s.pymateCardLeft}>
                <View style={[s.pymateIcon, isNitro && { backgroundColor: "#10B981" + "20" }]}>
                  <Text style={{ fontSize: 28 }}>🐍</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.pymateNameRow}>
                    <Text style={s.pymateName}>PyMate</Text>
                    <View style={[s.pymatePill, { backgroundColor: isNitro ? "#10B981" : "rgba(255,255,255,0.12)" }]}>
                      {isNitro
                        ? <MaterialCommunityIcons name="crown" size={9} color="#fff" />
                        : <Ionicons name="lock-closed" size={9} color="rgba(255,255,255,0.6)" />}
                      <Text style={s.pymatePillText}>{isNitro ? "PRO" : "NITRO"}</Text>
                    </View>
                  </View>
                  <Text style={s.pymateSub}>Python AI coding assistant & reference</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={17} color="rgba(255,255,255,0.3)" />
            </Pressable>
          </View>

          {/* ── COMPARE TABLE ── */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>FREE VS NITRO BAT</Text>
            <SectionCard>
              <View style={[s.compareHead, { backgroundColor: "rgba(255,255,255,0.04)" }]}>
                <Text style={[s.compareLabel, { color: "rgba(255,255,255,0.3)", fontSize: 10 }]}>Feature</Text>
                <Text style={[s.compareFree, { color: "rgba(255,255,255,0.3)", fontSize: 10 }]}>Free</Text>
                <Text style={[s.compareNitro, { color: BAT_ORANGE, fontSize: 10 }]}>Nitro Bat</Text>
              </View>
              {COMPARE_ROWS.map((row, i) => (
                <View key={i} style={[s.compareRow, i % 2 === 0 && { backgroundColor: "rgba(255,255,255,0.02)" }]}>
                  <Text style={s.compareLabel}>{row.label}</Text>
                  <Text style={s.compareFree}>{row.free}</Text>
                  <Text style={[s.compareNitro, { color: BAT_ORANGE }]}>{row.nitro}</Text>
                </View>
              ))}
            </SectionCard>
          </View>

          {/* ── BOTTOM CTA ── */}
          {!isNitro && (
            <View style={s.section}>
              <Pressable onPress={handleActivateDemo} style={({ pressed }) => [s.ctaBtn, pressed && { opacity: 0.9 }]}>
                <View style={s.ctaGlow} />
                <View style={s.ctaContent}>
                  <Text style={s.ctaBat}>🦇</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.ctaTitle}>Start Free 7-Day Trial</Text>
                    <Text style={s.ctaSub}>All Nitro Bat features · No card needed</Text>
                  </View>
                  <MaterialCommunityIcons name="lightning-bolt" size={24} color={GOLD} />
                </View>
              </Pressable>
            </View>
          )}

          {isNitro && (
            <View style={s.section}>
              <View style={s.activeBottomCard}>
                <View style={s.activeBottomGlow} />
                <Text style={s.activeBottomBat}>🦇</Text>
                <Text style={s.activeBottomTitle}>Nitro Bat Active!</Text>
                <Text style={s.activeBottomSub}>
                  {daysLeft > 0 ? `${daysLeft} days remaining.` : "Active."} All premium tools are unlocked.
                </Text>
                <View style={s.activeBottomDots}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <View key={i} style={[s.activeBottomDot, { backgroundColor: i < Math.ceil(daysLeft / 7) ? GOLD : "rgba(255,255,255,0.12)" }]} />
                  ))}
                </View>
              </View>
            </View>
          )}

        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: NITRO_DARK },
  scrollContent: { gap: 0 },

  // Hero
  hero: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: 20,
    position: "relative",
    overflow: "hidden",
  },
  heroGlowWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center" },
  glow1: { position: "absolute", width: 340, height: 340, borderRadius: 170, backgroundColor: BAT_ORANGE, top: -100, opacity: 0.1 },
  glow2: { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: NITRO_PURPLE, top: -50, right: -40 },

  batWrap: { alignItems: "center", justifyContent: "center", marginBottom: 14, position: "relative" },
  batGlowRing: { position: "absolute", width: 110, height: 110, borderRadius: 55, backgroundColor: BAT_ORANGE, opacity: 0.08 },
  batEmoji: { fontSize: 80 },

  heroTitle: { fontFamily: "Poppins_700Bold", fontSize: 36, color: "#fff", letterSpacing: 6, textAlign: "center" },
  heroBadgeRow: { flexDirection: "row", gap: 8, marginTop: 10, marginBottom: 14 },
  heroBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1 },
  heroBadgeText: { fontFamily: "Poppins_700Bold", fontSize: 10, letterSpacing: 0.8 },
  heroSub: { fontFamily: "Poppins_400Regular", fontSize: 14, color: TEXT_DIM, textAlign: "center", lineHeight: 23 },

  activeCard: {
    flexDirection: "row", alignItems: "center", marginTop: 20,
    backgroundColor: GOLD + "14", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: GOLD + "40",
    width: "100%", position: "relative", overflow: "hidden",
  },
  activeCardGlow: { position: "absolute", left: -20, top: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: GOLD, opacity: 0.12 },
  activeCardLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  activeIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: GOLD + "20", justifyContent: "center", alignItems: "center" },
  activeCardTitle: { fontFamily: "Poppins_700Bold", fontSize: 14, color: GOLD },
  activeCardSub: { fontFamily: "Poppins_400Regular", fontSize: 11, color: TEXT_DIM, marginTop: 2 },
  activeCardBtn: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  activeCardBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: TEXT_BRIGHT },

  // Sections
  section: { marginHorizontal: 18, marginTop: 24, gap: 12 },
  sectionLabel: { fontFamily: "Poppins_700Bold", fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 1.4 },

  // Toggle
  toggleWrap: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 4, height: 52, position: "relative" },
  toggleSlider: { position: "absolute", top: 4, height: 44, backgroundColor: BAT_ORANGE, borderRadius: 13, shadowColor: BAT_ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  toggleBtn: { flex: 1, justifyContent: "center", alignItems: "center" },
  toggleYearRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  toggleText: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: "rgba(255,255,255,0.4)" },
  toggleTextOn: { color: "#fff" },
  savePill: { backgroundColor: GOLD + "30", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  savePillText: { fontFamily: "Poppins_700Bold", fontSize: 9, color: GOLD, letterSpacing: 0.5 },

  // Plans
  plansWrap: { gap: 14 },
  planCard: {
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 22, padding: 20, borderWidth: 1.5,
    gap: 0, position: "relative", overflow: "hidden",
  },
  planBadge: { position: "absolute", top: -1, right: 18, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  planBadgeText: { fontFamily: "Poppins_700Bold", fontSize: 9, color: "#fff", letterSpacing: 0.6 },
  planTop: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 16 },
  planIconWrap: { width: 56, height: 56, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  planEmoji: { fontSize: 26 },
  planName: { fontFamily: "Poppins_700Bold", fontSize: 20 },
  planPriceRow: { flexDirection: "row", alignItems: "baseline", gap: 3, marginTop: 2 },
  planPrice: { fontFamily: "Poppins_700Bold", fontSize: 28 },
  planPer: { fontFamily: "Poppins_400Regular", fontSize: 14, color: "rgba(255,255,255,0.35)" },
  planMonthly: { fontFamily: "Poppins_500Medium", fontSize: 11, marginTop: 2 },
  planDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.07)", marginBottom: 14 },
  planFeature: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  planFeatureText: { fontFamily: "Poppins_400Regular", fontSize: 13, color: "rgba(255,255,255,0.75)", flex: 1, lineHeight: 20 },
  planBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 15, paddingVertical: 15, marginTop: 6, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8 },
  planBtnEmoji: { fontSize: 16 },
  planBtnText: { fontFamily: "Poppins_700Bold", fontSize: 14, color: "#fff" },

  trialRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 4 },
  trialText: { fontFamily: "Poppins_500Medium", fontSize: 13, color: GOLD },

  // Promo
  promoInner: { padding: 18, gap: 12 },
  promoRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  promoInputWrap: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 13, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", overflow: "hidden" },
  promoInput: { flex: 1, fontFamily: "Poppins_600SemiBold", fontSize: 14, color: "#fff", paddingHorizontal: 10, paddingVertical: 13, letterSpacing: 1 },
  promoApplyBtn: { backgroundColor: BAT_ORANGE, borderRadius: 13, paddingHorizontal: 18, paddingVertical: 13, shadowColor: BAT_ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  promoApplyText: { fontFamily: "Poppins_700Bold", fontSize: 14, color: "#fff" },
  promoResult: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 12, borderWidth: 1 },
  promoResultText: { fontFamily: "Poppins_500Medium", fontSize: 13, flex: 1 },
  promoHint: { fontFamily: "Poppins_400Regular", fontSize: 11, color: "rgba(255,255,255,0.22)", textAlign: "center", lineHeight: 18 },

  // Features list
  nitroFeatureRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  nitroFeatureBorder: { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  nitroFeatureIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.07)", justifyContent: "center", alignItems: "center" },
  nitroFeatureTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: TEXT_BRIGHT },
  nitroFeatureDesc: { fontFamily: "Poppins_400Regular", fontSize: 11, color: TEXT_DIM, marginTop: 1 },

  // PyMate shortcut
  pymateCard: { flexDirection: "row", alignItems: "center", backgroundColor: CARD_BG, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: CARD_BORDER },
  pymateCardLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 14 },
  pymateIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: "rgba(16,185,129,0.12)", justifyContent: "center", alignItems: "center" },
  pymateNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  pymateName: { fontFamily: "Poppins_700Bold", fontSize: 16, color: TEXT_BRIGHT },
  pymatePill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  pymatePillText: { fontFamily: "Poppins_700Bold", fontSize: 9, color: "#fff" },
  pymateSub: { fontFamily: "Poppins_400Regular", fontSize: 12, color: TEXT_DIM },

  // Compare
  compareHead: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, alignItems: "center" },
  compareRow: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, alignItems: "center" },
  compareLabel: { flex: 1, fontFamily: "Poppins_500Medium", fontSize: 13, color: TEXT_BRIGHT },
  compareFree: { width: 80, fontFamily: "Poppins_400Regular", fontSize: 12, color: TEXT_DIM, textAlign: "center" },
  compareNitro: { width: 90, fontFamily: "Poppins_600SemiBold", fontSize: 12, textAlign: "center" },

  // CTA
  ctaBtn: { borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: GOLD + "30" },
  ctaGlow: { position: "absolute", top: -30, left: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: GOLD, opacity: 0.08 },
  ctaContent: { flexDirection: "row", alignItems: "center", padding: 20, gap: 14, backgroundColor: GOLD + "10" },
  ctaBat: { fontSize: 32 },
  ctaTitle: { fontFamily: "Poppins_700Bold", fontSize: 15, color: "#fff" },
  ctaSub: { fontFamily: "Poppins_400Regular", fontSize: 12, color: TEXT_DIM, marginTop: 2 },

  // Active bottom
  activeBottomCard: { backgroundColor: GOLD + "10", borderRadius: 22, padding: 24, alignItems: "center", borderWidth: 1, borderColor: GOLD + "30", gap: 10, position: "relative", overflow: "hidden" },
  activeBottomGlow: { position: "absolute", top: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: GOLD, opacity: 0.06 },
  activeBottomBat: { fontSize: 44 },
  activeBottomTitle: { fontFamily: "Poppins_700Bold", fontSize: 22, color: GOLD },
  activeBottomSub: { fontFamily: "Poppins_400Regular", fontSize: 13, color: TEXT_DIM, textAlign: "center" },
  activeBottomDots: { flexDirection: "row", gap: 6, marginTop: 4 },
  activeBottomDot: { width: 28, height: 4, borderRadius: 2 },
});
