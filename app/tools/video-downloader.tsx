import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput, ScrollView,
  Platform, Animated, Easing, ActivityIndicator, Alert,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ToolHeader from "@/components/ToolHeader";
import { Colors } from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";

const YT_RED  = "#FF0000";
const TT_PINK = "#EE1D52";
const TT_DARK = "#161823";

type Platform_ = "youtube" | "tiktok" | null;
type Quality = { label: string; value: string };

const YT_QUALITIES: Quality[] = [
  { label: "Best", value: "max" },
  { label: "1080p", value: "1080" },
  { label: "720p",  value: "720"  },
  { label: "480p",  value: "480"  },
  { label: "360p",  value: "360"  },
];

const TT_QUALITIES: Quality[] = [
  { label: "HD Video",    value: "max" },
  { label: "SD Video",    value: "720" },
  { label: "Audio Only",  value: "audio" },
];

interface VideoInfo {
  platform: "youtube" | "tiktok";
  title: string;
  thumbnail: string;
  author: string;
  duration: number | null;
  hdUrl?: string;
  sdUrl?: string;
  audioUrl?: string;
}

function detectPlatform(url: string): Platform_ {
  if (!url) return null;
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("tiktok.com")) return "tiktok";
  return null;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── Pulsing shimmer bar ──────────────────────────────────────────────────────
function ShimmerBar({ width: w, height: h, style }: { width?: number | string; height: number; style?: object }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
  }, []);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.8] });
  return <Animated.View style={[{ width: w ?? "100%", height: h, borderRadius: h / 2, backgroundColor: "#E5E7EB", opacity }, style]} />;
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <View style={sk.card}>
      <ShimmerBar width="100%" height={180} style={{ borderRadius: 16, marginBottom: 14 }} />
      <ShimmerBar height={16} style={{ marginBottom: 8 }} />
      <ShimmerBar width="60%" height={12} />
    </View>
  );
}
const sk = StyleSheet.create({ card: { backgroundColor: Colors.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: Colors.cardBorder } });

export default function VideoDownloaderScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [url, setUrl] = useState("");
  const [detectedPlatform, setDetectedPlatform] = useState<Platform_>(null);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [dlLoading, setDlLoading] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState("max");
  const [copied, setCopied] = useState(false);
  const [lastDlUrl, setLastDlUrl] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const inputRef = useRef<TextInput>(null);
  const btnScale = useRef(new Animated.Value(1)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const p = detectPlatform(url.trim());
    setDetectedPlatform(p);
    if (!url.trim()) { setInfo(null); setFetchError(null); setLastDlUrl(null); }
  }, [url]);

  const animateCard = () => {
    cardAnim.setValue(0);
    cardSlide.setValue(20);
    Animated.parallel([
      Animated.timing(cardAnim, { toValue: 1, duration: 360, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(cardSlide, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();
  };

  const handleFetch = async () => {
    const trimmed = url.trim();
    if (!trimmed || !detectedPlatform) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFetchLoading(true);
    setInfo(null);
    setFetchError(null);
    setLastDlUrl(null);
    setSelectedQuality("max");

    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.93, tension: 200, friction: 8, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();

    try {
      const res = await fetch(new URL("/api/video-downloader/info", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setFetchError(data.error || "Could not load video. Check the URL.");
      } else {
        setInfo(data as VideoInfo);
        animateCard();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e: any) {
      setFetchError("Network error. Check your connection.");
    }
    setFetchLoading(false);
  };

  const handleDownload = async () => {
    if (!info) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setDlLoading(true);

    // TikTok: use direct URLs from tikwm
    if (info.platform === "tiktok") {
      const dlUrl =
        selectedQuality === "audio" ? info.audioUrl :
        selectedQuality === "720"   ? info.sdUrl :
        info.hdUrl || info.sdUrl;

      if (dlUrl) {
        setLastDlUrl(dlUrl);
        setDlLoading(false);
        await WebBrowser.openBrowserAsync(dlUrl);
        return;
      }
    }

    // YouTube & fallback: use cobalt.tools via backend
    try {
      const res = await fetch(new URL("/api/video-downloader/download", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), quality: selectedQuality }),
      });
      const data = await res.json();
      if (data.ok && data.url) {
        setLastDlUrl(data.url);
        await WebBrowser.openBrowserAsync(data.url);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert("Download Error", data.error || "Could not get download link.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (e: any) {
      Alert.alert("Network Error", "Check your connection and try again.");
    }
    setDlLoading(false);
  };

  const handleCopy = async () => {
    if (!lastDlUrl) return;
    await Clipboard.setStringAsync(lastDlUrl);
    setCopied(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCopied(false), 2200);
  };

  const handlePaste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) { setUrl(text); Haptics.selectionAsync(); }
    } catch {}
  };

  const accentColor = detectedPlatform === "tiktok" ? TT_PINK : detectedPlatform === "youtube" ? YT_RED : Colors.primary;
  const qualities = info?.platform === "tiktok" ? TT_QUALITIES : YT_QUALITIES;
  const canFetch = !!detectedPlatform && url.trim().length > 10;

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <ToolHeader title="Video Downloader" subtitle="YouTube & TikTok" accentColor={accentColor} />

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: bottomPad + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Platform banner ── */}
        <View style={s.platforms}>
          <View style={[s.platformChip, detectedPlatform === "youtube" && { backgroundColor: YT_RED, borderColor: YT_RED }]}>
            <MaterialCommunityIcons name="youtube" size={16} color={detectedPlatform === "youtube" ? "#fff" : YT_RED} />
            <Text style={[s.platformChipText, detectedPlatform === "youtube" && { color: "#fff" }]}>YouTube</Text>
          </View>
          <View style={s.platformPlus}>
            <Text style={s.platformPlusText}>+</Text>
          </View>
          <View style={[s.platformChip, detectedPlatform === "tiktok" && { backgroundColor: TT_PINK, borderColor: TT_PINK }]}>
            <MaterialCommunityIcons name="music-note" size={16} color={detectedPlatform === "tiktok" ? "#fff" : TT_PINK} />
            <Text style={[s.platformChipText, detectedPlatform === "tiktok" && { color: "#fff" }]}>TikTok</Text>
          </View>
        </View>

        {/* ── URL Input ── */}
        <View style={[s.inputCard, detectedPlatform && { borderColor: accentColor + "50" }]}>
          <View style={s.inputRow}>
            <View style={[s.inputIcon, { backgroundColor: detectedPlatform ? accentColor + "18" : Colors.separator }]}>
              {detectedPlatform === "youtube" && <MaterialCommunityIcons name="youtube" size={20} color={YT_RED} />}
              {detectedPlatform === "tiktok"  && <MaterialCommunityIcons name="music-note" size={20} color={TT_PINK} />}
              {!detectedPlatform && <Ionicons name="link-outline" size={20} color={Colors.textMuted} />}
            </View>
            <TextInput
              ref={inputRef}
              style={s.input}
              value={url}
              onChangeText={(t) => { setUrl(t); setInfo(null); setFetchError(null); }}
              placeholder="Paste YouTube or TikTok link…"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="search"
              onSubmitEditing={handleFetch}
            />
            {url.length > 0 ? (
              <Pressable onPress={() => { setUrl(""); setInfo(null); setFetchError(null); setLastDlUrl(null); }}>
                <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
              </Pressable>
            ) : (
              <Pressable onPress={handlePaste} style={s.pasteBtn}>
                <Ionicons name="clipboard-outline" size={14} color={Colors.primary} />
                <Text style={s.pasteBtnText}>Paste</Text>
              </Pressable>
            )}
          </View>

          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <Pressable
              onPress={handleFetch}
              disabled={!canFetch || fetchLoading}
              style={[s.fetchBtn, { backgroundColor: canFetch ? accentColor : Colors.cardBorder }, (!canFetch || fetchLoading) && { opacity: 0.7 }]}
            >
              {fetchLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <>
                    <Ionicons name="search" size={17} color="#fff" />
                    <Text style={s.fetchBtnText}>Fetch Video</Text>
                  </>}
            </Pressable>
          </Animated.View>
        </View>

        {/* ── Error ── */}
        {fetchError && (
          <View style={s.errorCard}>
            <Ionicons name="alert-circle" size={18} color={Colors.error} />
            <Text style={s.errorText}>{fetchError}</Text>
          </View>
        )}

        {/* ── Loading skeleton ── */}
        {fetchLoading && <SkeletonCard />}

        {/* ── Video info card ── */}
        {info && !fetchLoading && (
          <Animated.View style={[s.videoCard, { opacity: cardAnim, transform: [{ translateY: cardSlide }] }]}>
            {/* Thumbnail */}
            {info.thumbnail ? (
              <View style={s.thumbWrap}>
                <Image
                  source={{ uri: info.thumbnail }}
                  style={s.thumb}
                  contentFit="cover"
                />
                <View style={[s.platformBadge, { backgroundColor: info.platform === "youtube" ? YT_RED : TT_PINK }]}>
                  <MaterialCommunityIcons
                    name={info.platform === "youtube" ? "youtube" : "music-note"}
                    size={14} color="#fff"
                  />
                  <Text style={s.platformBadgeText}>{info.platform === "youtube" ? "YouTube" : "TikTok"}</Text>
                </View>
                {info.duration && (
                  <View style={s.durationBadge}>
                    <Text style={s.durationText}>{formatDuration(info.duration)}</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={[s.thumbPlaceholder, { backgroundColor: info.platform === "youtube" ? "#FFF0F0" : "#FFF0F5" }]}>
                <MaterialCommunityIcons name={info.platform === "youtube" ? "youtube" : "music-note"} size={48} color={info.platform === "youtube" ? YT_RED : TT_PINK} />
              </View>
            )}

            <View style={s.videoMeta}>
              <Text style={s.videoTitle} numberOfLines={3}>{info.title}</Text>
              <View style={s.authorRow}>
                <Ionicons name="person-circle-outline" size={15} color={Colors.textMuted} />
                <Text style={s.authorText} numberOfLines={1}>{info.author}</Text>
              </View>
            </View>

            {/* Quality selector */}
            <View style={s.qualitySection}>
              <Text style={s.qualityLabel}>Quality</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.qualityRow}>
                {qualities.map((q) => (
                  <Pressable
                    key={q.value}
                    onPress={() => { setSelectedQuality(q.value); Haptics.selectionAsync(); setLastDlUrl(null); }}
                    style={[s.qualityPill, selectedQuality === q.value && { backgroundColor: accentColor, borderColor: accentColor }]}
                  >
                    <Text style={[s.qualityPillText, selectedQuality === q.value && { color: "#fff" }]}>{q.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Download button */}
            <Pressable
              onPress={handleDownload}
              disabled={dlLoading}
              style={({ pressed }) => [s.dlBtn, { backgroundColor: accentColor, opacity: pressed || dlLoading ? 0.85 : 1 }]}
            >
              {dlLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <>
                    <Ionicons name="download" size={19} color="#fff" />
                    <Text style={s.dlBtnText}>Download {selectedQuality === "audio" ? "Audio" : "Video"}</Text>
                  </>}
            </Pressable>

            {/* Copy link (shows after first download attempt) */}
            {lastDlUrl && (
              <Pressable onPress={handleCopy} style={s.copyRow}>
                <Ionicons name={copied ? "checkmark-circle" : "copy-outline"} size={15} color={copied ? Colors.success : Colors.primary} />
                <Text style={[s.copyText, copied && { color: Colors.success }]}>
                  {copied ? "Link copied!" : "Copy download link"}
                </Text>
              </Pressable>
            )}
          </Animated.View>
        )}

        {/* ── Tips ── */}
        {!info && !fetchLoading && (
          <View style={s.tipsCard}>
            <Text style={s.tipsTitle}>How to use</Text>
            {[
              { icon: "logo-youtube" as const, color: YT_RED, text: "Copy a YouTube video URL from the YouTube app" },
              { icon: "musical-notes" as const, color: TT_PINK, text: "Copy a TikTok video link from the share menu" },
              { icon: "clipboard-outline" as const, color: Colors.primary, text: 'Tap "Paste" or paste the URL above' },
              { icon: "download-outline" as const, color: Colors.success, text: 'Hit "Fetch Video" then choose quality & download' },
            ].map((tip, i) => (
              <View key={i} style={s.tipRow}>
                <View style={[s.tipIcon, { backgroundColor: tip.color + "15" }]}>
                  <Ionicons name={tip.icon} size={16} color={tip.color} />
                </View>
                <Text style={s.tipText}>{tip.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Disclaimer */}
        <View style={s.disclaimer}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
          <Text style={s.disclaimerText}>
            For personal use only. Respect copyright & platform terms of service.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 16, gap: 14, paddingTop: 12 },

  platforms: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 4 },
  platformChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.cardBorder, backgroundColor: Colors.white },
  platformChipText: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: Colors.text },
  platformPlus: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.separator, justifyContent: "center", alignItems: "center" },
  platformPlusText: { fontFamily: "Poppins_700Bold", fontSize: 14, color: Colors.textMuted },

  inputCard: { backgroundColor: Colors.white, borderRadius: 20, padding: 16, gap: 12, borderWidth: 1.5, borderColor: Colors.cardBorder, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  inputIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  input: { flex: 1, fontFamily: "Poppins_400Regular", fontSize: 13, color: Colors.text, paddingVertical: 6 },
  pasteBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primary + "30" },
  pasteBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: Colors.primary },
  fetchBtn: { borderRadius: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  fetchBtnText: { fontFamily: "Poppins_700Bold", fontSize: 15, color: "#fff" },

  errorCard: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: Colors.errorLight, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.error + "30" },
  errorText: { fontFamily: "Poppins_400Regular", fontSize: 13, color: Colors.error, flex: 1, lineHeight: 20 },

  videoCard: { backgroundColor: Colors.white, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: Colors.cardBorder, shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.09, shadowRadius: 16, elevation: 5 },
  thumbWrap: { width: "100%", height: 200, position: "relative" },
  thumb: { width: "100%", height: "100%" },
  thumbPlaceholder: { width: "100%", height: 160, justifyContent: "center", alignItems: "center" },
  platformBadge: { position: "absolute", top: 10, left: 10, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  platformBadgeText: { fontFamily: "Poppins_700Bold", fontSize: 11, color: "#fff" },
  durationBadge: { position: "absolute", bottom: 10, right: 10, backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  durationText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: "#fff" },

  videoMeta: { padding: 16, gap: 6 },
  videoTitle: { fontFamily: "Poppins_700Bold", fontSize: 15, color: Colors.text, lineHeight: 22 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  authorText: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.textSecondary, flex: 1 },

  qualitySection: { paddingHorizontal: 16, paddingBottom: 10, gap: 10 },
  qualityLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: Colors.text },
  qualityRow: { gap: 8, paddingBottom: 2 },
  qualityPill: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.cardBorder },
  qualityPillText: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: Colors.text },

  dlBtn: { margin: 16, marginTop: 4, borderRadius: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 6 },
  dlBtnText: { fontFamily: "Poppins_700Bold", fontSize: 16, color: "#fff" },
  copyRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingBottom: 16 },
  copyText: { fontFamily: "Poppins_500Medium", fontSize: 13, color: Colors.primary },

  tipsCard: { backgroundColor: Colors.white, borderRadius: 18, padding: 16, gap: 12, borderWidth: 1, borderColor: Colors.cardBorder },
  tipsTitle: { fontFamily: "Poppins_700Bold", fontSize: 14, color: Colors.text },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  tipIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  tipText: { fontFamily: "Poppins_400Regular", fontSize: 13, color: Colors.textSecondary, flex: 1, lineHeight: 20, marginTop: 7 },

  disclaimer: { flexDirection: "row", gap: 8, alignItems: "flex-start", paddingVertical: 4 },
  disclaimerText: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textMuted, flex: 1, lineHeight: 17 },
});
