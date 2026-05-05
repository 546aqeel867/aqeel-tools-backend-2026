import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, Pressable, Platform,
  Alert, ScrollView, Animated, Easing, FlatList, useWindowDimensions,
} from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ToolHeader from "@/components/ToolHeader";
import { Colors } from "@/constants/colors";

const PURPLE = "#7C3AED";
const PINK = "#EC4899";
const TEAL = "#14B8A6";
const GOLD = "#F59E0B";

const DISC_COLORS = [PURPLE, PINK, TEAL, "#2563EB", "#EA580C", "#10B981"];

interface Track {
  id: string;
  uri: string;
  name: string;
  duration: number;
  size?: number;
}

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function cleanName(raw: string) {
  return raw.replace(/\.[^/.]+$/, "").replace(/_/g, " ").replace(/-/g, " – ");
}

function DiscArt({ color, isPlaying, size = 180 }: { color: string; isPlaying: boolean; size?: number }) {
  const rot = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isPlaying) {
      animRef.current = Animated.loop(
        Animated.timing(rot, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true })
      );
      animRef.current.start();
    } else {
      animRef.current?.stop();
    }
    return () => animRef.current?.stop();
  }, [isPlaying]);

  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const r = size / 2;

  return (
    <Animated.View style={[disc.outer, { width: size, height: size, borderRadius: r, transform: [{ rotate }] }]}>
      <View style={[disc.ring1, { borderColor: color + "60" }]} />
      <View style={[disc.ring2, { borderColor: color + "40" }]} />
      <View style={[disc.ring3, { borderColor: color + "25" }]} />
      <View style={[disc.center, { backgroundColor: color }]}>
        <View style={disc.hole} />
      </View>
      <View style={[disc.label, { backgroundColor: color + "20" }]}>
        <MaterialCommunityIcons name="music-note" size={22} color={color} />
      </View>
    </Animated.View>
  );
}

const disc = StyleSheet.create({
  outer: { backgroundColor: "#1A1A2E", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.1)", overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 12 },
  ring1: { position: "absolute", width: "88%", height: "88%", borderRadius: 999, borderWidth: 1 },
  ring2: { position: "absolute", width: "70%", height: "70%", borderRadius: 999, borderWidth: 1 },
  ring3: { position: "absolute", width: "52%", height: "52%", borderRadius: 999, borderWidth: 1 },
  center: { position: "absolute", width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  hole: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#1A1A2E" },
  label: { position: "absolute", width: "44%", height: "44%", borderRadius: 999, alignItems: "center", justifyContent: "center" },
});

export default function MusicPlayerScreen() {
  const { width: SW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [colorIdx, setColorIdx] = useState(0);
  const [loadingLib, setLoadingLib] = useState(false);
  const [view, setView] = useState<"player" | "library">("player");

  const currentTrack = tracks[currentIdx] ?? null;
  const accentColor = DISC_COLORS[colorIdx % DISC_COLORS.length];

  const player = useAudioPlayer(currentTrack ? { uri: currentTrack.uri } : null);
  const status = useAudioPlayerStatus(player);

  const isPlaying = status.playing;
  const positionSecs = status.currentTime ?? 0;
  const durationSecs = status.duration ?? 0;
  const progress = durationSecs > 0 ? positionSecs / durationSecs : 0;

  useEffect(() => {
    if (status.didJustFinish) handleNext();
  }, [status.didJustFinish]);

  const loadFromLibrary = async () => {
    setLoadingLib(true);
    const { status: perm } = await MediaLibrary.requestPermissionsAsync();
    if (perm !== "granted") {
      Alert.alert("Permission needed", "Allow media library access to load your music.");
      setLoadingLib(false);
      return;
    }
    try {
      const { assets } = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.audio,
        first: 200,
        sortBy: MediaLibrary.SortBy.default,
      });
      if (assets.length === 0) {
        Alert.alert("No audio found", "No audio files were found in your device library.");
        setLoadingLib(false);
        return;
      }
      const loaded: Track[] = assets.map((a) => ({
        id: a.id,
        uri: a.uri,
        name: cleanName(a.filename),
        duration: a.duration,
        size: undefined,
      }));
      setTracks(loaded);
      setCurrentIdx(0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert("Error", "Could not load audio files.");
    }
    setLoadingLib(false);
  };

  const pickAudioFile = async () => {
    const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm !== "granted") {
      Alert.alert("Permission needed", "Allow photo library access to pick audio files.");
      return;
    }
    try {
      const result = await (ImagePicker as any).launchImageLibraryAsync({
        mediaTypes: "livePhotos",
        allowsEditing: false,
        quality: 1,
      });
      if (!result.canceled) {
        Alert.alert("Tip", "For best results, use 'Load from Library' to access your audio files directly.");
      }
    } catch {
      Alert.alert("Tip", "Use 'Load from Library' to access your music collection.");
    }
  };

  const handlePlay = () => {
    if (!currentTrack) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPlaying) player.pause();
    else player.play();
  };

  const handlePrev = () => {
    if (tracks.length === 0) return;
    Haptics.selectionAsync();
    const next = (currentIdx - 1 + tracks.length) % tracks.length;
    setCurrentIdx(next);
    setColorIdx((c) => c + 1);
  };

  const handleNext = () => {
    if (tracks.length === 0) return;
    Haptics.selectionAsync();
    const next = (currentIdx + 1) % tracks.length;
    setCurrentIdx(next);
    setColorIdx((c) => c + 1);
  };

  const seekTo = async (pct: number) => {
    if (!player || durationSecs === 0) return;
    await player.seekTo(pct * durationSecs);
  };

  const selectTrack = (idx: number) => {
    setCurrentIdx(idx);
    setColorIdx(idx);
    setView("player");
    Haptics.selectionAsync();
  };

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <ToolHeader title="Music Player" subtitle="Your songs, beautifully" />

      {tracks.length === 0 ? (
        <ScrollView contentContainerStyle={[s.emptyWrap, { paddingBottom: bottomPad + 32 }]}>
          <View style={[s.discEmpty, { borderColor: PURPLE + "40" }]}>
            <DiscArt color={PURPLE} isPlaying={false} size={160} />
          </View>
          <Text style={s.emptyTitle}>Music Player</Text>
          <Text style={s.emptyDesc}>
            Load your device music library or pick individual audio files to start listening.
          </Text>
          <Pressable
            onPress={loadFromLibrary}
            disabled={loadingLib}
            style={({ pressed }) => [s.loadBtn, { backgroundColor: PURPLE }, pressed && { opacity: 0.88 }]}
          >
            {loadingLib
              ? <><MaterialCommunityIcons name="loading" size={20} color="#fff" /><Text style={s.loadBtnText}>Loading...</Text></>
              : <><MaterialCommunityIcons name="music-box-multiple" size={20} color="#fff" /><Text style={s.loadBtnText}>Load from Library</Text></>
            }
          </Pressable>
          <Text style={s.orText}>Browse up to 200 songs from your device</Text>
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={s.tabBar}>
            <Pressable onPress={() => setView("player")} style={[s.tab, view === "player" && [s.tabActive, { borderBottomColor: accentColor }]]}>
              <Text style={[s.tabText, view === "player" && { color: accentColor }]}>Now Playing</Text>
            </Pressable>
            <Pressable onPress={() => setView("library")} style={[s.tab, view === "library" && [s.tabActive, { borderBottomColor: accentColor }]]}>
              <Text style={[s.tabText, view === "library" && { color: accentColor }]}>Library ({tracks.length})</Text>
            </Pressable>
          </View>

          {view === "player" ? (
            <ScrollView contentContainerStyle={[s.playerWrap, { paddingBottom: bottomPad + 32 }]} showsVerticalScrollIndicator={false}>
              <View style={s.discWrap}>
                <View style={[s.discShadowRing, { borderColor: accentColor + "30" }]} />
                <DiscArt color={accentColor} isPlaying={isPlaying} size={200} />
              </View>

              <View style={s.trackInfo}>
                <Text style={s.trackName} numberOfLines={2}>{currentTrack?.name ?? "—"}</Text>
                <Text style={s.trackCount}>{currentIdx + 1} of {tracks.length} songs</Text>
              </View>

              <View style={s.progressWrap}>
                <Text style={s.timeLabel}>{formatTime(positionSecs)}</Text>
                <Pressable
                  style={s.progressTrack}
                  onPress={(e) => {
                    const x = e.nativeEvent.locationX;
                    seekTo(x / (SW - 80));
                  }}
                >
                  <View style={[s.progressFill, { width: `${progress * 100}%` as any, backgroundColor: accentColor }]} />
                  <View style={[s.progressThumb, { left: `${Math.max(0, progress * 100 - 2)}%` as any, backgroundColor: accentColor }]} />
                </Pressable>
                <Text style={s.timeLabel}>{formatTime(durationSecs)}</Text>
              </View>

              <View style={s.mainControls}>
                <Pressable onPress={handlePrev} hitSlop={12} style={s.skipBtn}>
                  <Ionicons name="play-skip-back" size={30} color={Colors.text} />
                </Pressable>
                <Pressable onPress={handlePlay} style={[s.playBtnLarge, { backgroundColor: accentColor, shadowColor: accentColor }]}>
                  <Ionicons name={isPlaying ? "pause" : "play"} size={36} color="#fff" />
                </Pressable>
                <Pressable onPress={handleNext} hitSlop={12} style={s.skipBtn}>
                  <Ionicons name="play-skip-forward" size={30} color={Colors.text} />
                </Pressable>
              </View>

              <Pressable
                onPress={loadFromLibrary}
                disabled={loadingLib}
                style={s.reloadBtn}
              >
                <MaterialCommunityIcons name="refresh" size={16} color={Colors.textMuted} />
                <Text style={s.reloadBtnText}>Reload Library</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <FlatList
              data={tracks}
              keyExtractor={(t) => t.id}
              contentContainerStyle={[s.libList, { paddingBottom: bottomPad + 24 }]}
              showsVerticalScrollIndicator={false}
              renderItem={({ item, index }) => {
                const active = index === currentIdx;
                const c = DISC_COLORS[index % DISC_COLORS.length];
                return (
                  <Pressable
                    onPress={() => selectTrack(index)}
                    style={({ pressed }) => [s.trackRow, active && [s.trackRowActive, { borderColor: c + "50" }], pressed && { opacity: 0.85 }]}
                  >
                    <View style={[s.trackNumBox, { backgroundColor: active ? c + "20" : Colors.separator }]}>
                      {active && isPlaying
                        ? <MaterialCommunityIcons name="music-note" size={16} color={c} />
                        : <Text style={[s.trackNum, active && { color: c }]}>{index + 1}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.trackRowName, active && { color: c }]} numberOfLines={1}>{item.name}</Text>
                      <Text style={s.trackRowDur}>{formatTime(item.duration)}</Text>
                    </View>
                    {active && <View style={[s.activeDot, { backgroundColor: c }]} />}
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  emptyWrap: { alignItems: "center", paddingTop: 24, paddingHorizontal: 24, gap: 16 },
  discEmpty: { width: 200, height: 200, borderRadius: 100, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  emptyTitle: { fontFamily: "Poppins_700Bold", fontSize: 24, color: Colors.text, letterSpacing: -0.3 },
  emptyDesc: { fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 22 },
  loadBtn: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, paddingHorizontal: 28, paddingVertical: 16, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  loadBtnText: { fontFamily: "Poppins_700Bold", fontSize: 15, color: "#fff" },
  orText: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.textMuted },

  tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: Colors.cardBorder, backgroundColor: Colors.white },
  tab: { flex: 1, paddingVertical: 13, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: {},
  tabText: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: Colors.textSecondary },

  playerWrap: { alignItems: "center", paddingHorizontal: 24, paddingTop: 28, gap: 24 },
  discWrap: { position: "relative", alignItems: "center", justifyContent: "center" },
  discShadowRing: { position: "absolute", width: 230, height: 230, borderRadius: 115, borderWidth: 1.5 },

  trackInfo: { alignItems: "center", gap: 4, width: "100%" },
  trackName: { fontFamily: "Poppins_700Bold", fontSize: 20, color: Colors.text, textAlign: "center", letterSpacing: -0.3, lineHeight: 28 },
  trackCount: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.textMuted },

  progressWrap: { flexDirection: "row", alignItems: "center", gap: 10, width: "100%" },
  timeLabel: { fontFamily: "Poppins_500Medium", fontSize: 11, color: Colors.textMuted, minWidth: 36 },
  progressTrack: { flex: 1, height: 4, backgroundColor: Colors.cardBorder, borderRadius: 4, position: "relative", overflow: "visible" },
  progressFill: { height: 4, borderRadius: 4 },
  progressThumb: { position: "absolute", top: -5, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: Colors.white, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 4 },

  mainControls: { flexDirection: "row", alignItems: "center", gap: 28 },
  skipBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.white, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: Colors.cardBorder, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  playBtnLarge: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.45, shadowRadius: 20, elevation: 10 },

  reloadBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: Colors.separator, borderWidth: 1, borderColor: Colors.cardBorder },
  reloadBtnText: { fontFamily: "Poppins_500Medium", fontSize: 12, color: Colors.textMuted },

  libList: { paddingHorizontal: 16, paddingTop: 12, gap: 4 },
  trackRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.cardBorder },
  trackRowActive: { backgroundColor: Colors.white },
  trackNumBox: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  trackNum: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: Colors.textMuted },
  trackRowName: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: Colors.text },
  trackRowDur: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  activeDot: { width: 8, height: 8, borderRadius: 4 },
});
