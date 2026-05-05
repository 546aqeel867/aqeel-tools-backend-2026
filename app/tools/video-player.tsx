import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, Pressable, Platform,
  Alert, ScrollView, useWindowDimensions, PanResponder,
} from "react-native";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ToolHeader from "@/components/ToolHeader";
import { Colors } from "@/constants/colors";


const BG = "#090A0F";
const CARD = "#13151C";
const BORDER = "rgba(255,255,255,0.08)";
const ACCENT = "#6366F1";

function getQualityBadge(w: number, h: number) {
  const longer = Math.max(w, h);
  if (longer >= 7680) return { label: "8K", color: "#8B5CF6" };
  if (longer >= 3840) return { label: "4K", color: "#EC4899" };
  if (longer >= 1920) return { label: "FHD", color: "#10B981" };
  if (longer >= 1280) return { label: "HD", color: "#3B82F6" };
  if (longer >= 854) return { label: "480p", color: "#F59E0B" };
  return { label: "SD", color: "#6B7280" };
}

function formatTime(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface VideoInfo {
  uri: string;
  name: string;
  width: number;
  height: number;
  duration: number;
}

function VolumeSlider({
  volume,
  onChange,
}: {
  volume: number;
  onChange: (v: number) => void;
}) {
  const { width: SW } = useWindowDimensions();
  const trackWidth = SW - 32 - 48 - 16;
  const sliderRef = useRef<View>(null);
  const trackX = useRef(0);

  const clamp = (v: number) => Math.max(0, Math.min(1, v));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const x = e.nativeEvent.pageX - trackX.current;
        const newVol = clamp(x / trackWidth);
        onChange(newVol);
        Haptics.selectionAsync();
      },
      onPanResponderMove: (e) => {
        const x = e.nativeEvent.pageX - trackX.current;
        const newVol = clamp(x / trackWidth);
        onChange(newVol);
      },
    })
  ).current;

  return (
    <View style={vs.row}>
      <Ionicons
        name={volume === 0 ? "volume-mute" : volume < 0.4 ? "volume-low" : volume < 0.7 ? "volume-medium" : "volume-high"}
        size={20}
        color="#fff"
        style={{ width: 24 }}
      />
      <View
        ref={sliderRef}
        onLayout={(e) => {
          sliderRef.current?.measure((_x, _y, _w, _h, px) => {
            trackX.current = px;
          });
        }}
        style={[vs.track, { width: trackWidth }]}
        {...panResponder.panHandlers}
        hitSlop={{ top: 14, bottom: 14, left: 0, right: 0 }}
      >
        <View style={[vs.fill, { width: `${volume * 100}%` as any }]} />
        <View style={[vs.thumb, { left: `${Math.max(0, volume * 100 - 1)}%` as any }]} />
      </View>
      <Text style={vs.label}>{Math.round(volume * 100)}%</Text>
    </View>
  );
}

const vs = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  track: {
    height: 5, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 5,
    position: "relative", overflow: "visible",
  },
  fill: { height: 5, backgroundColor: ACCENT, borderRadius: 5 },
  thumb: {
    position: "absolute", top: -5, width: 15, height: 15, borderRadius: 7.5,
    backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 4,
  },
  label: { fontFamily: "Poppins_700Bold", fontSize: 11, color: "rgba(255,255,255,0.85)", minWidth: 34, textAlign: "right" },
});

export default function VideoPlayerScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const videoRef = useRef<Video>(null);
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [rate, setRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const controlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo library access to pick videos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      quality: 1,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setVideo({
        uri: asset.uri,
        name: asset.fileName || asset.uri.split("/").pop() || "Video",
        width: asset.width || 1920,
        height: asset.height || 1080,
        duration: (asset.duration || 0) * 1000,
      });
      setIsPlaying(false);
      setPosition(0);
      setDuration((asset.duration || 0) * 1000);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setIsPlaying(status.isPlaying);
    setPosition(status.positionMillis || 0);
    if (status.durationMillis) setDuration(status.durationMillis);
  }, []);

  const togglePlay = async () => {
    if (!videoRef.current) return;
    Haptics.selectionAsync();
    if (isPlaying) await videoRef.current.pauseAsync();
    else await videoRef.current.playAsync();
    flashControls();
  };

  const toggleMute = async () => {
    if (!videoRef.current) return;
    const next = !isMuted;
    setIsMuted(next);
    await videoRef.current.setIsMutedAsync(next);
    Haptics.selectionAsync();
  };

  const handleVolumeChange = async (v: number) => {
    setVolume(v);
    if (!videoRef.current) return;
    await videoRef.current.setVolumeAsync(v);
    if (v === 0 && !isMuted) {
      setIsMuted(true);
      await videoRef.current.setIsMutedAsync(true);
    } else if (v > 0 && isMuted) {
      setIsMuted(false);
      await videoRef.current.setIsMutedAsync(false);
    }
  };

  const seekBy = async (secs: number) => {
    if (!videoRef.current) return;
    const next = Math.max(0, Math.min(position + secs * 1000, duration));
    await videoRef.current.setPositionAsync(next);
    setPosition(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const cycleRate = async () => {
    if (!videoRef.current) return;
    const idx = RATES.indexOf(rate);
    const next = RATES[(idx + 1) % RATES.length];
    setRate(next);
    await videoRef.current.setRateAsync(next, true);
    Haptics.selectionAsync();
  };

  const toggleFullscreen = async () => {
    if (!videoRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isFullscreen) {
      await (videoRef.current as any).dismissFullscreenPlayer?.();
    } else {
      await (videoRef.current as any).presentFullscreenPlayer?.();
    }
  };

  const onFullscreenUpdate = useCallback(({ fullscreenUpdate }: any) => {
    const FullscreenUpdate = { PLAYER_WILL_PRESENT: 0, PLAYER_DID_PRESENT: 1, PLAYER_WILL_DISMISS: 2, PLAYER_DID_DISMISS: 3 };
    if (fullscreenUpdate === FullscreenUpdate.PLAYER_DID_PRESENT) setIsFullscreen(true);
    if (fullscreenUpdate === FullscreenUpdate.PLAYER_DID_DISMISS) setIsFullscreen(false);
  }, []);

  const flashControls = () => {
    setShowControls(true);
    if (controlTimer.current) clearTimeout(controlTimer.current);
    controlTimer.current = setTimeout(() => setShowControls(false), 3200);
  };

  const progress = duration > 0 ? position / duration : 0;
  const quality = video ? getQualityBadge(video.width, video.height) : null;

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <ToolHeader title="Video Player" subtitle="8K · 4K · HD · Fullscreen" />

      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: bottomPad + 24 }]} showsVerticalScrollIndicator={false}>
        {!video ? (
          <View style={s.emptyState}>
            <View style={s.emptyGlow} />
            <View style={s.emptyIconWrap}>
              <MaterialCommunityIcons name="play-circle" size={80} color={ACCENT} />
            </View>
            <Text style={s.emptyTitle}>Video Player</Text>
            <Text style={s.emptyDesc}>
              Play any video with fullscreen support, volume control, and speed adjustment.
            </Text>
            <View style={s.qualityRow}>
              {["8K", "4K", "FHD", "HD", "SD"].map((q, i) => {
                const colors = ["#8B5CF6", "#EC4899", "#10B981", "#3B82F6", "#6B7280"];
                return (
                  <View key={q} style={[s.qualityChip, { borderColor: colors[i] + "60", backgroundColor: colors[i] + "20" }]}>
                    <Text style={[s.qualityChipText, { color: colors[i] }]}>{q}</Text>
                  </View>
                );
              })}
            </View>
            <Pressable onPress={pickVideo} style={({ pressed }) => [s.pickBtn, pressed && { opacity: 0.88 }]}>
              <MaterialCommunityIcons name="folder-play" size={22} color="#fff" />
              <Text style={s.pickBtnText}>Open Video from Library</Text>
            </Pressable>
            <Text style={s.pickHint}>Supports MP4, MOV, MKV and more</Text>
          </View>
        ) : (
          <>
            {/* ── VIDEO PLAYER ── */}
            <Pressable style={s.videoWrap} onPress={flashControls}>
              <Video
                ref={videoRef}
                source={{ uri: video.uri }}
                style={s.video}
                resizeMode={ResizeMode.CONTAIN}
                onPlaybackStatusUpdate={onPlaybackStatusUpdate}
                onFullscreenUpdate={onFullscreenUpdate}
                useNativeControls={false}
                volume={volume}
                isMuted={isMuted}
              />

              {showControls && (
                <View style={s.controlsOverlay}>
                  {/* Top bar */}
                  <View style={s.overlayTop}>
                    {quality && (
                      <View style={[s.qualityBadge, { backgroundColor: quality.color + "30", borderColor: quality.color + "80" }]}>
                        <MaterialCommunityIcons name="film" size={11} color={quality.color} />
                        <Text style={[s.qualityBadgeText, { color: quality.color }]}>{quality.label}</Text>
                      </View>
                    )}
                    <Text style={s.videoNameOverlay} numberOfLines={1}>{video.name}</Text>
                    <Pressable onPress={toggleFullscreen} hitSlop={12} style={s.fsBtn}>
                      <Ionicons
                        name={isFullscreen ? "contract" : "expand"}
                        size={20}
                        color="#fff"
                      />
                    </Pressable>
                  </View>

                  {/* Center controls */}
                  <View style={s.overlayCenter}>
                    <Pressable onPress={() => seekBy(-10)} hitSlop={16} style={s.seekBtn}>
                      <Ionicons name="play-back" size={28} color="#fff" />
                      <Text style={s.seekLabel}>10s</Text>
                    </Pressable>
                    <Pressable onPress={togglePlay} style={s.playBtn}>
                      <Ionicons name={isPlaying ? "pause" : "play"} size={38} color="#fff" />
                    </Pressable>
                    <Pressable onPress={() => seekBy(10)} hitSlop={16} style={s.seekBtn}>
                      <Ionicons name="play-forward" size={28} color="#fff" />
                      <Text style={s.seekLabel}>10s</Text>
                    </Pressable>
                  </View>

                  {/* Volume slider */}
                  <View style={s.overlayVolume}>
                    <VolumeSlider volume={volume} onChange={handleVolumeChange} />
                  </View>

                  {/* Progress bar */}
                  <View style={s.overlayBottom}>
                    <Text style={s.timeText}>{formatTime(position)}</Text>
                    <View style={s.progressTrack}>
                      <View style={[s.progressFill, { width: `${progress * 100}%` as any }]} />
                      <View style={[s.progressThumb, { left: `${Math.max(0, progress * 100 - 1)}%` as any }]} />
                    </View>
                    <Text style={s.timeText}>{formatTime(duration)}</Text>
                  </View>
                </View>
              )}
            </Pressable>

            {/* ── INFO ── */}
            <View style={s.infoCard}>
              <View style={s.infoRow}>
                <Ionicons name="videocam-outline" size={16} color={Colors.textMuted} />
                <Text style={s.infoTitle} numberOfLines={2}>{video.name}</Text>
                {quality && (
                  <View style={[s.qualityBadge, { backgroundColor: quality.color + "25", borderColor: quality.color + "60" }]}>
                    <Text style={[s.qualityBadgeText, { color: quality.color }]}>{quality.label}</Text>
                  </View>
                )}
              </View>
              <Text style={s.infoSub}>
                {video.width} × {video.height} px · {formatTime(duration)} · {rate}× speed
              </Text>
            </View>

            {/* ── CONTROLS CARD ── */}
            <View style={s.controlsCard}>
              <Text style={s.controlsTitle}>Playback Controls</Text>

              {/* Row 1: Play / Mute / Speed / Fullscreen */}
              <View style={s.controlsRow}>
                <Pressable onPress={togglePlay} style={[s.ctrlBtn, { backgroundColor: ACCENT }]}>
                  <Ionicons name={isPlaying ? "pause" : "play"} size={22} color="#fff" />
                  <Text style={s.ctrlBtnText}>{isPlaying ? "Pause" : "Play"}</Text>
                </Pressable>
                <Pressable onPress={toggleMute} style={[s.ctrlBtn, isMuted && { backgroundColor: "#EF4444" }]}>
                  <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={20} color="#fff" />
                  <Text style={s.ctrlBtnText}>{isMuted ? "Unmute" : "Mute"}</Text>
                </Pressable>
                <Pressable onPress={cycleRate} style={s.ctrlBtn}>
                  <MaterialCommunityIcons name="speedometer" size={20} color="#fff" />
                  <Text style={s.ctrlBtnText}>{rate}×</Text>
                </Pressable>
                <Pressable onPress={toggleFullscreen} style={[s.ctrlBtn, { backgroundColor: "#1E293B" }]}>
                  <Ionicons name={isFullscreen ? "contract" : "expand"} size={20} color="#fff" />
                  <Text style={s.ctrlBtnText}>Full</Text>
                </Pressable>
              </View>

              {/* Row 2: Seek buttons */}
              <View style={s.controlsRow}>
                <Pressable onPress={() => seekBy(-30)} style={s.ctrlBtnSm}>
                  <Ionicons name="play-back" size={16} color={Colors.text} />
                  <Text style={s.ctrlBtnSmText}>−30s</Text>
                </Pressable>
                <Pressable onPress={() => seekBy(-10)} style={s.ctrlBtnSm}>
                  <Ionicons name="play-back" size={16} color={Colors.text} />
                  <Text style={s.ctrlBtnSmText}>−10s</Text>
                </Pressable>
                <Pressable onPress={() => seekBy(10)} style={s.ctrlBtnSm}>
                  <Ionicons name="play-forward" size={16} color={Colors.text} />
                  <Text style={s.ctrlBtnSmText}>+10s</Text>
                </Pressable>
                <Pressable onPress={() => seekBy(30)} style={s.ctrlBtnSm}>
                  <Ionicons name="play-forward" size={16} color={Colors.text} />
                  <Text style={s.ctrlBtnSmText}>+30s</Text>
                </Pressable>
              </View>

              {/* Row 3: Volume control */}
              <View style={s.volumeCard}>
                <Text style={s.volumeLabel}>Volume</Text>
                <View style={s.volumeRow}>
                  <Pressable
                    onPress={() => handleVolumeChange(Math.max(0, volume - 0.1))}
                    style={s.volBtn}
                    hitSlop={8}
                  >
                    <Ionicons name="remove" size={18} color={Colors.text} />
                  </Pressable>
                  <View style={s.volumeBarWrap}>
                    <View style={s.volumeTrack}>
                      <View style={[s.volumeFill, { width: `${volume * 100}%` as any }]} />
                    </View>
                  </View>
                  <Pressable
                    onPress={() => handleVolumeChange(Math.min(1, volume + 0.1))}
                    style={s.volBtn}
                    hitSlop={8}
                  >
                    <Ionicons name="add" size={18} color={Colors.text} />
                  </Pressable>
                  <Text style={s.volumePct}>{Math.round(volume * 100)}%</Text>
                </View>
                {/* Quick volume presets */}
                <View style={s.volPresets}>
                  {[0, 25, 50, 75, 100].map((pct) => (
                    <Pressable
                      key={pct}
                      onPress={() => {
                        handleVolumeChange(pct / 100);
                        Haptics.selectionAsync();
                      }}
                      style={[
                        s.volPresetBtn,
                        Math.round(volume * 100) === pct && s.volPresetBtnActive,
                      ]}
                    >
                      <Text style={[
                        s.volPresetText,
                        Math.round(volume * 100) === pct && s.volPresetTextActive,
                      ]}>
                        {pct === 0 ? "🔇" : `${pct}%`}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <Pressable onPress={pickVideo} style={s.changeBtn}>
              <MaterialCommunityIcons name="folder-play" size={18} color={ACCENT} />
              <Text style={s.changeBtnText}>Open Different Video</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 16 },

  emptyState: { alignItems: "center", paddingTop: 32, paddingHorizontal: 8, gap: 16, position: "relative" },
  emptyGlow: { position: "absolute", top: 20, width: 220, height: 220, borderRadius: 110, backgroundColor: ACCENT, opacity: 0.06 },
  emptyIconWrap: { width: 120, height: 120, borderRadius: 60, backgroundColor: ACCENT + "15", justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: ACCENT + "40" },
  emptyTitle: { fontFamily: "Poppins_700Bold", fontSize: 24, color: Colors.text, letterSpacing: -0.3 },
  emptyDesc: { fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 22 },
  qualityRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  qualityChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1 },
  qualityChipText: { fontFamily: "Poppins_700Bold", fontSize: 12 },
  pickBtn: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: ACCENT, borderRadius: 16, paddingHorizontal: 28, paddingVertical: 16, marginTop: 8, shadowColor: ACCENT, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  pickBtnText: { fontFamily: "Poppins_700Bold", fontSize: 15, color: "#fff" },
  pickHint: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.textMuted },

  videoWrap: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000", borderRadius: 16, overflow: "hidden", marginTop: 12, borderWidth: 1, borderColor: BORDER, position: "relative" },
  video: { width: "100%", height: "100%" },

  controlsOverlay: { position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.48)", justifyContent: "space-between", padding: 12 },
  overlayTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  videoNameOverlay: { flex: 1, fontFamily: "Poppins_500Medium", fontSize: 11, color: "#fff" },
  fsBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },

  overlayCenter: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 28 },
  seekBtn: { alignItems: "center", gap: 2 },
  seekLabel: { fontFamily: "Poppins_700Bold", fontSize: 9, color: "rgba(255,255,255,0.7)" },
  playBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.18)", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.4)" },

  overlayVolume: { paddingHorizontal: 4 },
  overlayBottom: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeText: { fontFamily: "Poppins_500Medium", fontSize: 10, color: "#fff", minWidth: 36 },
  progressTrack: { flex: 1, height: 3, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 3, position: "relative", overflow: "visible" },
  progressFill: { height: 3, backgroundColor: ACCENT, borderRadius: 3 },
  progressThumb: { position: "absolute", top: -4, width: 11, height: 11, borderRadius: 5.5, backgroundColor: "#fff" },

  qualityBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  qualityBadgeText: { fontFamily: "Poppins_700Bold", fontSize: 10 },

  infoCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginTop: 12, borderWidth: 1, borderColor: Colors.cardBorder, gap: 6 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoTitle: { flex: 1, fontFamily: "Poppins_600SemiBold", fontSize: 13, color: Colors.text },
  infoSub: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.textMuted },

  controlsCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, marginTop: 12, gap: 12, borderWidth: 1, borderColor: Colors.cardBorder },
  controlsTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: Colors.text },
  controlsRow: { flexDirection: "row", gap: 8 },
  ctrlBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 11 },
  ctrlBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 11, color: "#fff" },
  ctrlBtnSm: { flex: 1, alignItems: "center", gap: 4, backgroundColor: Colors.separator, borderRadius: 12, paddingVertical: 11, borderWidth: 1, borderColor: Colors.cardBorder },
  ctrlBtnSmText: { fontFamily: "Poppins_600SemiBold", fontSize: 11, color: Colors.text },

  volumeCard: { backgroundColor: Colors.separator, borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: Colors.cardBorder },
  volumeLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: Colors.text },
  volumeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  volBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.white, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: Colors.cardBorder },
  volumeBarWrap: { flex: 1 },
  volumeTrack: { height: 8, backgroundColor: Colors.cardBorder, borderRadius: 6, overflow: "hidden" },
  volumeFill: { height: 8, backgroundColor: ACCENT, borderRadius: 6 },
  volumePct: { fontFamily: "Poppins_700Bold", fontSize: 13, color: Colors.primary, minWidth: 40, textAlign: "right" },
  volPresets: { flexDirection: "row", gap: 8 },
  volPresetBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.cardBorder },
  volPresetBtnActive: { backgroundColor: ACCENT + "15", borderColor: ACCENT + "60" },
  volPresetText: { fontFamily: "Poppins_600SemiBold", fontSize: 11, color: Colors.textSecondary },
  volPresetTextActive: { color: ACCENT },

  changeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: ACCENT + "50", backgroundColor: ACCENT + "10" },
  changeBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: ACCENT },
});
