import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Platform,
  Alert,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  requestRecordingPermissionsAsync,
  RecordingPresets,
  AudioSource,
} from "expo-audio";
import { Colors } from "@/constants/colors";
import ToolHeader from "@/components/ToolHeader";

interface Memo {
  id: string;
  uri: string;
  durationMs: number;
  createdAt: number;
  label: string;
}

function makeId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function WaveBar({ active, index }: { active: boolean; index: number }) {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!active) {
      Animated.timing(anim, { toValue: 0.3, duration: 200, useNativeDriver: true }).start();
      return;
    }
    const duration = 250 + (index % 5) * 80;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.2 + Math.random() * 0.8, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.15 + Math.random() * 0.4, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  return <Animated.View style={[styles.waveBar, { transform: [{ scaleY: anim }] }]} />;
}

function RecordingWave({ active }: { active: boolean }) {
  return (
    <View style={styles.waveRow}>
      {Array.from({ length: 20 }).map((_, i) => (
        <WaveBar key={i} index={i} active={active} />
      ))}
    </View>
  );
}

function MemoCard({
  memo,
  playing,
  onPlay,
  onDelete,
}: {
  memo: Memo;
  playing: boolean;
  onPlay: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.memoCard, playing && styles.memoCardActive]}>
      <Pressable onPress={onPlay} style={styles.memoPlayBtn}>
        <Ionicons
          name={playing ? "pause-circle" : "play-circle"}
          size={40}
          color={playing ? Colors.success : Colors.primary}
        />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.memoLabel} numberOfLines={1}>{memo.label}</Text>
        <View style={styles.memoMeta}>
          <Ionicons name="time-outline" size={11} color={Colors.textMuted} />
          <Text style={styles.memoMetaText}>{formatDuration(memo.durationMs)}</Text>
          <Text style={styles.memoMetaDot}>·</Text>
          <Text style={styles.memoMetaText}>{formatTime(memo.createdAt)}</Text>
        </View>
        {playing && (
          <View style={styles.playingBar}>
            <View style={styles.playingDot} />
            <Text style={styles.playingText}>Now playing</Text>
          </View>
        )}
      </View>
      <Pressable onPress={onDelete} hitSlop={8} style={styles.memoDeleteBtn}>
        <Ionicons name="trash-outline" size={18} color={Colors.error} />
      </Pressable>
    </View>
  );
}

function PlayerCard({ memo, onStop }: { memo: Memo; onStop: () => void }) {
  const source: AudioSource = { uri: memo.uri };
  const player = useAudioPlayer(source);

  useEffect(() => {
    player.play();
    return () => {
      player.pause();
    };
  }, []);

  return null;
}

export default function VoiceMemoScreen() {
  const insets = useSafeAreaInsets();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const memoCountRef = useRef(1);
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 24;

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 100);

  useEffect(() => {
    if (Platform.OS === "web") {
      setPermissionGranted(true);
      return;
    }
    requestRecordingPermissionsAsync().then(({ granted }) => {
      setPermissionGranted(granted);
    });
  }, []);

  useEffect(() => {
    if (!isRecording) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current);
    }, 100);
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [isRecording]);

  const startRecording = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Mobile only", "Voice recording works on iOS and Android devices via Expo Go.");
      return;
    }
    if (!permissionGranted) {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert("Permission required", "Please allow microphone access to record memos.");
        return;
      }
      setPermissionGranted(true);
    }
    try {
      setPlayingId(null);
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      setElapsed(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (e: any) {
      Alert.alert("Recording failed", e?.message || "Could not start recording.");
    }
  };

  const stopRecording = async () => {
    try {
      await recorder.stop();
      const uri = recorder.uri;
      const durationMs = elapsed || 1000;
      setIsRecording(false);
      setElapsed(0);

      if (uri) {
        const label = `Memo ${memoCountRef.current++}`;
        const newMemo: Memo = { id: makeId(), uri, durationMs, createdAt: Date.now(), label };
        setMemos((prev) => [newMemo, ...prev]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e: any) {
      Alert.alert("Stop failed", e?.message || "Could not stop recording.");
      setIsRecording(false);
    }
  };

  const handleRecordPress = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  const handlePlay = useCallback((memo: Memo) => {
    if (playingId === memo.id) {
      setPlayingId(null);
    } else {
      setPlayingId(memo.id);
      Haptics.selectionAsync();
    }
  }, [playingId]);

  const deleteMemo = (id: string) => {
    Alert.alert("Delete memo?", "This recording will be permanently deleted.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          if (playingId === id) setPlayingId(null);
          setMemos((prev) => prev.filter((m) => m.id !== id));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  };

  const playingMemo = memos.find((m) => m.id === playingId);
  const bottomContentPad = bottomPad + 210;

  return (
    <View style={styles.container}>
      <ToolHeader title="Voice Memo" subtitle="Record, save & replay audio memos" accentColor="#7C3AED" />

      {playingMemo && <PlayerCard memo={playingMemo} onStop={() => setPlayingId(null)} />}

      <FlatList
        data={memos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomContentPad }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!memos.length}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="microphone-outline" size={40} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No recordings yet</Text>
            <Text style={styles.emptyText}>
              {Platform.OS === "web"
                ? "Open on your phone in Expo Go to record voice memos"
                : "Tap the button below to record your first voice memo"}
            </Text>
          </View>
        }
        ListHeaderComponent={
          memos.length > 0 ? (
            <Text style={styles.listHeader}>
              {memos.length} {memos.length === 1 ? "memo" : "memos"}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <MemoCard
            memo={item}
            playing={playingId === item.id}
            onPlay={() => handlePlay(item)}
            onDelete={() => deleteMemo(item.id)}
          />
        )}
      />

      <View style={[styles.recordPanel, { paddingBottom: bottomPad }]}>
        {Platform.OS === "web" && (
          <View style={styles.webNote}>
            <Ionicons name="phone-portrait-outline" size={14} color="#7C3AED" />
            <Text style={styles.webNoteText}>Recording available on iOS & Android in Expo Go</Text>
          </View>
        )}

        <RecordingWave active={isRecording} />

        <Text style={styles.elapsedText}>
          {isRecording ? formatDuration(elapsed) : "Tap to record"}
        </Text>

        <Pressable
          onPress={handleRecordPress}
          disabled={Platform.OS === "web"}
          style={({ pressed }) => [
            styles.recordBtn,
            isRecording && styles.recordBtnActive,
            { transform: [{ scale: pressed ? 0.93 : 1 }], opacity: Platform.OS === "web" ? 0.5 : 1 },
          ]}
        >
          <Ionicons name={isRecording ? "stop" : "mic"} size={32} color={Colors.white} />
        </Pressable>

        {isRecording && (
          <View style={styles.recBadge}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>Recording…</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const CARD_SHADOW = {
  shadowColor: Colors.shadow,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 6,
  elevation: 2,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  listContent: { paddingHorizontal: 16, gap: 10, paddingTop: 12 },
  listHeader: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  memoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...CARD_SHADOW,
  },
  memoCardActive: { borderColor: Colors.success, borderWidth: 1.5 },
  memoPlayBtn: { width: 44, justifyContent: "center", alignItems: "center" },
  memoLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: Colors.text },
  memoMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  memoMetaText: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textMuted },
  memoMetaDot: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textMuted },
  playingBar: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 },
  playingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  playingText: { fontFamily: "Poppins_500Medium", fontSize: 11, color: Colors.success },
  memoDeleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: Colors.errorLight,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.separator,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 18, color: Colors.text },
  emptyText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 240,
  },
  recordPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingTop: 16,
    paddingHorizontal: 24,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
    gap: 12,
  },
  webNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F3E8FF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  webNoteText: { fontFamily: "Poppins_400Regular", fontSize: 11, color: "#7C3AED" },
  waveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 44,
  },
  waveBar: {
    width: 4,
    height: 30,
    borderRadius: 2,
    backgroundColor: "#7C3AED",
    opacity: 0.65,
  },
  elapsedText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 22,
    color: Colors.text,
    letterSpacing: 1,
  },
  recordBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#7C3AED",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  recordBtnActive: { backgroundColor: "#DC2626", shadowColor: "#DC2626" },
  recBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingBottom: 4,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#DC2626" },
  recText: { fontFamily: "Poppins_500Medium", fontSize: 13, color: "#DC2626" },
});
