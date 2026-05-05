import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Platform, Animated, useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, MaterialIcons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";
import { useNitro } from "@/contexts/NitroContext";
import { AppLogo } from "@/components/AppLogo";

const COLS = 2;
const GAP = 12;
const H_PAD = 16;
const GOLD = "#F59E0B";
const ORANGE = "#FF6B00";

type Category = "AI" | "Finance" | "Health" | "Media" | "Productivity" | "Utility";

interface Tool {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  iconLib: "ionicons" | "material" | "community" | "feather";
  iconName: string;
  iconColor: string;
  iconBg: string;
  badge?: string;
  paid?: boolean;
  category: Category;
}

const ALL_TOOLS: Tool[] = [
  // ── Free tools ──────────────────────────────────────────────────────────
  { id: "qr",           title: "QR Code",         subtitle: "Generate, scan & share",    route: "/tools/qr-tool",           iconLib: "community", iconName: "qrcode",                 iconColor: "#7C3AED", iconBg: "#F3EEFF", category: "Utility" },
  { id: "translator",   title: "Translator",       subtitle: "16 languages + voice",      route: "/tools/translator",         iconLib: "community", iconName: "translate",              iconColor: "#7C3AED", iconBg: "#F3EEFF",  badge: "AI", category: "AI" },
  { id: "currency",     title: "Currency",         subtitle: "Live exchange rates",        route: "/tools/currency-converter", iconLib: "community", iconName: "currency-usd",           iconColor: "#059669", iconBg: "#ECFDF5", category: "Finance" },
  { id: "bmi",          title: "BMI Calculator",   subtitle: "Health & weight index",      route: "/tools/bmi-calculator",     iconLib: "ionicons",  iconName: "fitness-outline",        iconColor: "#DB2777", iconBg: "#FDF2F8", category: "Health" },
  { id: "password",     title: "Password Gen",     subtitle: "Secure passwords",           route: "/tools/password-generator", iconLib: "ionicons",  iconName: "shield-checkmark-outline", iconColor: "#059669", iconBg: "#ECFDF5", category: "Utility" },
  { id: "unit",         title: "Unit Converter",   subtitle: "Weight, Length, Temp",       route: "/tools/unit-converter",     iconLib: "community", iconName: "ruler-square-compass",   iconColor: "#D97706", iconBg: "#FFFBEB", category: "Finance" },
  { id: "age",          title: "Age Calculator",   subtitle: "Exact age from DOB",         route: "/tools/age-calculator",     iconLib: "ionicons",  iconName: "calendar-outline",       iconColor: "#DB2777", iconBg: "#FDF2F8", category: "Health" },
  { id: "notes",        title: "Smart Notes",      subtitle: "Tags, pins & search",        route: "/tools/notes",              iconLib: "feather",   iconName: "edit-3",                 iconColor: "#EA580C", iconBg: "#FFF7ED", category: "Productivity" },
  { id: "voice-memo",   title: "Voice Memo",       subtitle: "Record & replay audio",      route: "/tools/voice-memo",         iconLib: "community", iconName: "microphone-outline",     iconColor: "#7C3AED", iconBg: "#F3EEFF",  badge: "NEW", category: "Productivity" },
  { id: "loan",         title: "Loan Calculator",  subtitle: "EMI & repayment plan",       route: "/tools/loan-calculator",    iconLib: "ionicons",  iconName: "calculator-outline",     iconColor: "#059669", iconBg: "#ECFDF5", category: "Finance" },
  { id: "world-clock",  title: "World Clock",      subtitle: "Track time globally",        route: "/tools/world-clock",        iconLib: "ionicons",  iconName: "globe-outline",          iconColor: "#0891B2", iconBg: "#F0FDFF", category: "Utility" },
  { id: "tip-calc",     title: "Tip Calculator",   subtitle: "Split bills instantly",      route: "/tools/tip-calculator",     iconLib: "ionicons",  iconName: "receipt-outline",        iconColor: "#059669", iconBg: "#ECFDF5", category: "Finance" },
  { id: "flashcard",    title: "Flashcards",       subtitle: "Study smarter",              route: "/tools/flashcard",          iconLib: "community", iconName: "cards-outline",          iconColor: "#7C3AED", iconBg: "#F3EEFF", category: "Productivity" },
  { id: "code-notes",   title: "Code Snippets",    subtitle: "Save & search code",         route: "/tools/code-notes",         iconLib: "community", iconName: "code-braces",            iconColor: "#0891B2", iconBg: "#F0FDFF", category: "Productivity" },
  { id: "photo-editor", title: "Photo Editor",     subtitle: "Filters, draw & stickers",   route: "/tools/photo-editor",       iconLib: "community", iconName: "palette-outline",        iconColor: "#7C3AED", iconBg: "#F3EEFF", category: "Media" },
  { id: "ai-image",     title: "AI Art Prompt",    subtitle: "Generate image prompts",     route: "/tools/ai-image-prompt",    iconLib: "community", iconName: "image-filter-drama",     iconColor: "#7C3AED", iconBg: "#F3EEFF",  badge: "AI", category: "AI" },
  { id: "ai-code",      title: "Code Helper",      subtitle: "Write & debug code",         route: "/tools/ai-code-helper",     iconLib: "community", iconName: "code-braces",            iconColor: "#0891B2", iconBg: "#F0FDFF",  badge: "AI", category: "AI" },
  { id: "ai-story",     title: "Story Writer",     subtitle: "AI creative writing",        route: "/tools/ai-story-writer",    iconLib: "ionicons",  iconName: "pencil",                 iconColor: "#EA580C", iconBg: "#FFF7ED",  badge: "AI", category: "AI" },
  { id: "video-player", title: "Video Player",     subtitle: "4K · HD · fullscreen",       route: "/tools/video-player",       iconLib: "community", iconName: "play-circle",            iconColor: "#6366F1", iconBg: "#EEF2FF", category: "Media" },
  { id: "music-player", title: "Music Player",     subtitle: "Songs & audio library",      route: "/tools/music-player",       iconLib: "community", iconName: "music-circle",           iconColor: "#EC4899", iconBg: "#FDF2F8", category: "Media" },
  { id: "video-dl",     title: "Video Downloader", subtitle: "YouTube & TikTok · Free",   route: "/tools/video-downloader",   iconLib: "community", iconName: "download-circle",        iconColor: "#FF0000", iconBg: "#FFF0F0",  badge: "NEW", category: "Media" },
  { id: "zara",         title: "Zara AI Call",     subtitle: "Voice AI · memory · 🇵🇰",   route: "/tools/ai-voice-assistant", iconLib: "community", iconName: "robot-excited-outline",  iconColor: "#10B981", iconBg: "#ECFDF5",  badge: "NEW", category: "AI" },
  { id: "settings",     title: "API Settings",     subtitle: "Manage AI & voice keys",     route: "/tools/settings",           iconLib: "ionicons",  iconName: "key-outline",            iconColor: "#7C3AED", iconBg: "#F3EEFF", category: "Utility" },

  // ── Nitro (Paid) tools ───────────────────────────────────────────────────
  { id: "pymate",      title: "PyMate",           subtitle: "Python AI coding assistant", route: "/tools/pymate",              iconLib: "community", iconName: "language-python",        iconColor: "#10B981", iconBg: "#ECFDF5",  badge: "NITRO", paid: true, category: "AI" },
  { id: "ai-img-gen",  title: "AI Image Gen",     subtitle: "Text to image with AI",      route: "/tools/ai-image-generator",  iconLib: "community", iconName: "image-auto-adjust",      iconColor: "#7C3AED", iconBg: "#F3EEFF",  badge: "NITRO", paid: true, category: "AI" },
  { id: "trip",        title: "Trip Planner",     subtitle: "Itinerary, map & checklist", route: "/tools/trip-planner",        iconLib: "ionicons",  iconName: "earth-outline",          iconColor: "#059669", iconBg: "#ECFDF5",  badge: "NITRO", paid: true, category: "AI" },
  { id: "bio-gen",     title: "Bio Generator",    subtitle: "AI bios for every platform", route: "/tools/bio-generator",       iconLib: "ionicons",  iconName: "person-circle-outline",  iconColor: "#7C3AED", iconBg: "#F3EEFF",  badge: "NITRO", paid: true, category: "AI" },
  { id: "thumbnail",   title: "Thumbnail Ideas",  subtitle: "YouTube thumbnail concepts", route: "/tools/thumbnail-ideas",     iconLib: "community", iconName: "youtube",                iconColor: "#FF0000", iconBg: "#FFF0F0",  badge: "NITRO", paid: true, category: "Media" },
];

const CATEGORIES: { id: "all" | Category; label: string; icon: string; color: string }[] = [
  { id: "all",          label: "All",          icon: "apps-outline",          color: Colors.primary },
  { id: "AI",           label: "AI",           icon: "sparkles-outline",      color: "#7C3AED" },
  { id: "Media",        label: "Media",        icon: "play-circle-outline",   color: "#6366F1" },
  { id: "Finance",      label: "Finance",      icon: "cash-outline",          color: "#059669" },
  { id: "Productivity", label: "Productivity", icon: "bulb-outline",          color: "#EA580C" },
  { id: "Health",       label: "Health",       icon: "fitness-outline",       color: "#DB2777" },
  { id: "Utility",      label: "Utility",      icon: "construct-outline",     color: "#0891B2" },
];

const FREE_TOOLS = ALL_TOOLS.filter((t) => !t.paid);
const PAID_TOOLS = ALL_TOOLS.filter((t) => t.paid);

function ToolIcon({ lib, name, size, color }: { lib: Tool["iconLib"]; name: string; size: number; color: string }) {
  if (lib === "ionicons") return <Ionicons name={name as any} size={size} color={color} />;
  if (lib === "material") return <MaterialIcons name={name as any} size={size} color={color} />;
  if (lib === "community") return <MaterialCommunityIcons name={name as any} size={size} color={color} />;
  return <Feather name={name as any} size={size} color={color} />;
}

function CategoryBar({ active, onChange }: { active: "all" | Category; onChange: (c: "all" | Category) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={cat.row}
      style={cat.wrap}
    >
      {CATEGORIES.map((c) => {
        const isActive = active === c.id;
        return (
          <Pressable
            key={c.id}
            onPress={() => { onChange(c.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            style={[cat.chip, isActive && { backgroundColor: c.color, borderColor: c.color }]}
          >
            <Ionicons
              name={c.icon as any}
              size={14}
              color={isActive ? "#fff" : c.color}
            />
            <Text style={[cat.chipLabel, isActive && cat.chipLabelActive]}>{c.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const cat = StyleSheet.create({
  wrap: { marginBottom: 16, marginHorizontal: -H_PAD },
  row: { paddingHorizontal: H_PAD, gap: 8, flexDirection: "row", alignItems: "center" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.cardBorder,
    backgroundColor: Colors.white,
  },
  chipLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: Colors.textSecondary },
  chipLabelActive: { color: "#fff" },
});

function AnimatedToolCard({ tool, onPress, index, isPaid = false }: { tool: Tool; onPress: () => void; index: number; isPaid?: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    const delay = 300 + index * 40;
    Animated.parallel([
      Animated.timing(entranceAnim, { toValue: 1, duration: 360, delay, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, delay, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  const handlePressIn = () => Animated.spring(scale, { toValue: 0.95, tension: 200, friction: 10, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }).start();

  const badgeColor =
    tool.badge === "NITRO" ? ORANGE :
    tool.badge === "AI" ? Colors.primary :
    tool.badge === "NEW" ? "#EA580C" : Colors.success;

  return (
    <Animated.View style={[s.cardWrap, { opacity: entranceAnim, transform: [{ scale }, { translateY: slideAnim }] }]}>
      <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={[s.card, isPaid && s.paidCard]}>
        {isPaid && <View style={s.paidGlow} />}
        {tool.badge && (
          <View style={[s.badge, { backgroundColor: badgeColor }]}>
            {tool.badge === "NITRO" && <MaterialCommunityIcons name="lightning-bolt" size={8} color="#fff" />}
            <Text style={s.badgeText}>{tool.badge}</Text>
          </View>
        )}
        <View style={[s.iconBox, { backgroundColor: tool.iconBg }]}>
          <ToolIcon lib={tool.iconLib} name={tool.iconName} size={26} color={tool.iconColor} />
        </View>
        <Text style={s.cardTitle} numberOfLines={1}>{tool.title}</Text>
        <Text style={s.cardSubtitle} numberOfLines={2}>{tool.subtitle}</Text>
        <View style={s.cardArrow}>
          <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

function ToolGrid({ tools, startIndex, isPaid }: { tools: Tool[]; startIndex: number; isPaid?: boolean }) {
  const { incrementToolsUsed } = useApp();
  const rows: Tool[][] = [];
  for (let i = 0; i < tools.length; i += 2) rows.push(tools.slice(i, i + 2));
  return (
    <View style={{ gap: GAP }}>
      {rows.map((pair, rowIdx) => (
        <View key={rowIdx} style={s.row}>
          {pair.map((tool, colIdx) => (
            <AnimatedToolCard
              key={tool.id}
              tool={tool}
              isPaid={isPaid}
              index={startIndex + rowIdx * 2 + colIdx}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                incrementToolsUsed();
                router.push(tool.route as any);
              }}
            />
          ))}
          {pair.length === 1 && <View style={{ flex: 1 }} />}
        </View>
      ))}
    </View>
  );
}

function AnimatedBannerCard({ onPress, color, bg, border, icon, title, subtitle, titleColor, chevronColor }: {
  onPress: () => void; color: string; bg: string; border: string;
  icon: React.ReactNode; title: string; subtitle: string; titleColor: string; chevronColor: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => Animated.spring(scale, { toValue: 0.95, tension: 200, friction: 10, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }).start();
  return (
    <Animated.View style={[s.bannerWrap, { transform: [{ scale }] }]}>
      <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={[s.banner, { backgroundColor: bg, borderColor: border }]}>
        <View style={[s.bannerIcon, { backgroundColor: color }]}>{icon}</View>
        <View style={{ flex: 1 }}>
          <Text style={[s.bannerTitle, { color: titleColor }]}>{title}</Text>
          <Text style={s.bannerSub}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={chevronColor} />
      </Pressable>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { username, toolsUsedCount } = useApp();
  const { isNitro } = useNitro();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [activeCategory, setActiveCategory] = useState<"all" | Category>("all");
  const filteredFree = activeCategory === "all" ? FREE_TOOLS : FREE_TOOLS.filter((t) => t.category === activeCategory);
  const filteredPaid = activeCategory === "all" ? PAID_TOOLS : PAID_TOOLS.filter((t) => t.category === activeCategory);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-18)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const statsScale = useRef(new Animated.Value(0.92)).current;
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const avatarScale = useRef(new Animated.Value(1)).current;
  const avatarPulse = useRef(new Animated.Value(1)).current;
  const nitroGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.spring(headerSlide, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.delay(180),
      Animated.parallel([
        Animated.timing(statsAnim, { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.spring(statsScale, { toValue: 1, tension: 90, friction: 9, useNativeDriver: true }),
      ]),
    ]).start();
    Animated.sequence([Animated.delay(300), Animated.timing(bannerAnim, { toValue: 1, duration: 340, useNativeDriver: true })]).start();
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(avatarPulse, { toValue: 1.07, duration: 1600, useNativeDriver: true }),
      Animated.timing(avatarPulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
    ]));
    const t = setTimeout(() => pulse.start(), 1200);
    Animated.loop(Animated.sequence([
      Animated.timing(nitroGlow, { toValue: 1, duration: 1800, useNativeDriver: true }),
      Animated.timing(nitroGlow, { toValue: 0, duration: 1800, useNativeDriver: true }),
    ])).start();
    return () => clearTimeout(t);
  }, []);

  const handleAvatarPress = () => {
    Animated.sequence([
      Animated.spring(avatarScale, { toValue: 0.88, tension: 200, friction: 8, useNativeDriver: true }),
      Animated.spring(avatarScale, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
    ]).start(() => router.push("/(tabs)/profile"));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const initial = username.charAt(0).toUpperCase();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const nitroGlowOpacity = nitroGlow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: Platform.OS === "web" ? 34 : 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER ── */}
        <Animated.View style={[s.header, { opacity: headerAnim, transform: [{ translateY: headerSlide }] }]}>
          <View style={s.headerLeft}>
            <AppLogo size="sm" variant="icon-text" />
          </View>
          <View style={s.headerRight}>
            <View style={s.greetingStack}>
              <Text style={s.greeting}>{greeting},</Text>
              <Text style={s.username} numberOfLines={1}>{username} 👋</Text>
            </View>
            {/* Nitro quick-access button */}
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/(tabs)/nitro" as any); }}
              style={s.nitroBtn}
            >
              <Animated.View style={[s.nitroBtnGlow, { opacity: nitroGlowOpacity }]} />
              <MaterialCommunityIcons name="lightning-bolt" size={17} color={isNitro ? GOLD : ORANGE} />
            </Pressable>
            <Pressable onPress={handleAvatarPress}>
              <Animated.View style={[s.avatar, { transform: [{ scale: Animated.multiply(avatarScale, avatarPulse) }] }]}>
                <Text style={s.avatarLetter}>{initial}</Text>
              </Animated.View>
            </Pressable>
          </View>
        </Animated.View>

        {/* ── STATS ── */}
        <Animated.View style={[s.statsCard, { opacity: statsAnim, transform: [{ scale: statsScale }] }]}>
          <View style={s.statItem}>
            <Text style={s.statNumber}>{toolsUsedCount}</Text>
            <Text style={s.statLabel}>Tools Used</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statNumber}>{FREE_TOOLS.length}</Text>
            <Text style={s.statLabel}>Free Tools</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={[s.statNumber, { color: ORANGE }]}>{PAID_TOOLS.length}</Text>
            <Text style={s.statLabel}>Nitro Tools</Text>
          </View>
        </Animated.View>

        {/* ── QUICK BANNERS ── */}
        <Animated.View style={[s.bannerRow, { opacity: bannerAnim }]}>
          <AnimatedBannerCard
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/(tabs)/chat"); }}
            color={Colors.primary} bg={Colors.primaryLight} border={Colors.primary + "40"}
            icon={<MaterialCommunityIcons name="robot" size={20} color="#fff" />}
            title="Zeno.V2 AI" subtitle="Ask anything · plan trips"
            titleColor={Colors.primary} chevronColor={Colors.primary}
          />
          <AnimatedBannerCard
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/(tabs)/games"); }}
            color="#F59E0B" bg="#FFFBEB" border="#FDE68A"
            icon={<Ionicons name="game-controller" size={20} color="#fff" />}
            title="Game Bar" subtitle="9 free offline games"
            titleColor="#D97706" chevronColor="#F59E0B"
          />
        </Animated.View>

        {/* ── CATEGORY FILTER BAR ── */}
        <Animated.View style={{ opacity: bannerAnim }}>
          <CategoryBar active={activeCategory} onChange={setActiveCategory} />
        </Animated.View>

        {/* ── FREE TOOLS SECTION ── */}
        {filteredFree.length > 0 && (
          <>
            <Animated.View style={{ opacity: bannerAnim }}>
              <View style={s.sectionHeaderRow}>
                <Text style={s.sectionTitle}>Free Tools</Text>
                <View style={s.sectionCountPill}>
                  <Text style={s.sectionCountText}>{filteredFree.length}</Text>
                </View>
              </View>
            </Animated.View>
            <ToolGrid tools={filteredFree} startIndex={0} />
          </>
        )}

        {/* ── PAID TOOLS SECTION BANNER ── */}
        {(activeCategory === "all" || filteredPaid.length > 0) && (
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/(tabs)/nitro" as any); }}
            style={({ pressed }) => [s.paidBanner, pressed && { opacity: 0.9 }]}
          >
            <View style={s.paidBannerGlow} />
            <View style={s.paidBannerLeft}>
              <View style={s.paidBannerIconWrap}>
                <MaterialCommunityIcons name="lightning-bolt" size={22} color={GOLD} />
              </View>
              <View>
                <View style={s.paidBannerTitleRow}>
                  <Text style={s.paidBannerTitle}>Nitro Tools</Text>
                  <View style={s.paidBannerPill}>
                    <Text style={s.paidBannerPillText}>
                      {activeCategory === "all" ? PAID_TOOLS.length : filteredPaid.length} tools
                    </Text>
                  </View>
                </View>
                <Text style={s.paidBannerSub}>
                  {isNitro ? "All Nitro tools unlocked ✓" : "Tap to upgrade · from $2.08/mo"}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={GOLD + "AA"} />
          </Pressable>
        )}

        {/* ── PAID TOOLS GRID ── */}
        {filteredPaid.length > 0 && (
          <ToolGrid tools={filteredPaid} startIndex={filteredFree.length} isPaid />
        )}

        {/* ── EMPTY FILTER STATE ── */}
        {filteredFree.length === 0 && filteredPaid.length === 0 && (
          <View style={s.emptyState}>
            <Ionicons name="search-outline" size={44} color={Colors.textMuted} />
            <Text style={s.emptyTitle}>No tools in this category</Text>
            <Text style={s.emptySub}>Try a different filter</Text>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: H_PAD },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 18, paddingBottom: 14 },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  greetingStack: { alignItems: "flex-end", maxWidth: 160, flexShrink: 1 },
  greeting: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.textSecondary },
  username: { fontFamily: "Poppins_700Bold", fontSize: 18, color: Colors.text, letterSpacing: -0.3 },

  nitroBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: ORANGE + "14", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: ORANGE + "30", position: "relative", overflow: "hidden" },
  nitroBtnGlow: { position: "absolute", inset: 0, backgroundColor: ORANGE, borderRadius: 12 },

  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.primary, justifyContent: "center", alignItems: "center", shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  avatarLetter: { fontFamily: "Poppins_700Bold", fontSize: 18, color: "#fff" },

  // Stats
  statsCard: { backgroundColor: Colors.white, borderRadius: 20, padding: 18, flexDirection: "row", alignItems: "center", marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 3, borderWidth: 1, borderColor: Colors.cardBorder },
  statItem: { flex: 1, alignItems: "center", gap: 2 },
  statNumber: { fontFamily: "Poppins_700Bold", fontSize: 22, color: Colors.primary },
  statLabel: { fontFamily: "Poppins_400Regular", fontSize: 10, color: Colors.textSecondary, textAlign: "center" },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.cardBorder },

  // Banners
  bannerRow: { flexDirection: "row", gap: GAP, marginBottom: 20 },
  bannerWrap: { flex: 1 },
  banner: { borderRadius: 16, padding: 13, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1 },
  bannerIcon: { width: 38, height: 38, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  bannerTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 13 },
  bannerSub: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textSecondary, marginTop: 2 },

  // Section headers
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  sectionTitle: { fontFamily: "Poppins_700Bold", fontSize: 17, color: Colors.text },
  sectionCountPill: { backgroundColor: Colors.separator, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: Colors.cardBorder },
  sectionCountText: { fontFamily: "Poppins_700Bold", fontSize: 11, color: Colors.textMuted },

  // Paid banner
  paidBanner: { borderRadius: 20, marginVertical: 20, padding: 18, flexDirection: "row", alignItems: "center", backgroundColor: "#0D0820", borderWidth: 1.5, borderColor: ORANGE + "45", overflow: "hidden", shadowColor: ORANGE, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8, gap: 12 },
  paidBannerGlow: { position: "absolute", left: -20, top: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: ORANGE, opacity: 0.12 },
  paidBannerLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 14 },
  paidBannerIconWrap: { width: 50, height: 50, borderRadius: 16, backgroundColor: ORANGE + "22", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: ORANGE + "40" },
  paidBannerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  paidBannerTitle: { fontFamily: "Poppins_700Bold", fontSize: 17, color: "#fff" },
  paidBannerPill: { backgroundColor: GOLD + "25", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: GOLD + "40" },
  paidBannerPillText: { fontFamily: "Poppins_700Bold", fontSize: 10, color: GOLD },
  paidBannerSub: { fontFamily: "Poppins_400Regular", fontSize: 12, color: "rgba(255,255,255,0.5)" },

  // Empty state
  emptyState: { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 16, color: Colors.textSecondary },
  emptySub: { fontFamily: "Poppins_400Regular", fontSize: 13, color: Colors.textMuted },

  // Tool grid
  row: { flexDirection: "row", gap: GAP },
  cardWrap: { flex: 1 },
  card: { backgroundColor: Colors.white, borderRadius: 20, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 4, borderWidth: 1, borderColor: Colors.cardBorder, minHeight: 138, position: "relative", overflow: "hidden" },
  paidCard: { borderColor: ORANGE + "35", backgroundColor: "#FFFBF5" },
  paidGlow: { position: "absolute", top: -20, right: -20, width: 70, height: 70, borderRadius: 35, backgroundColor: ORANGE, opacity: 0.06 },
  badge: { position: "absolute", top: 10, right: 10, flexDirection: "row", alignItems: "center", gap: 2, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontFamily: "Poppins_700Bold", fontSize: 9, color: "#fff", letterSpacing: 0.3 },
  iconBox: { width: 54, height: 54, borderRadius: 16, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  cardTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: Colors.text, marginBottom: 3 },
  cardSubtitle: { fontFamily: "Poppins_400Regular", fontSize: 11.5, color: Colors.textSecondary, lineHeight: 16, flex: 1 },
  cardArrow: { alignSelf: "flex-end", marginTop: 6 },
});
