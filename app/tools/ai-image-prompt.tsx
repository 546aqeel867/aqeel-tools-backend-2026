import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import ToolHeader from "@/components/ToolHeader";
import { useApp } from "@/contexts/AppContext";
import { aiChat } from "@/lib/ai";

const STYLES = ["Photorealistic", "Digital Art", "Watercolor", "Oil Painting", "Anime", "Sketch", "3D Render", "Cinematic"];
const MOODS = ["Dramatic", "Peaceful", "Dark", "Bright", "Mysterious", "Futuristic", "Vintage", "Epic"];
const SUBJECTS = ["Portrait", "Landscape", "Architecture", "Fantasy", "Sci-Fi", "Animals", "Abstract", "Space"];

export default function AIImagePrompt() {
  const insets = useSafeAreaInsets();
  const { apiKeys, hasAiKey } = useApp();
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("Photorealistic");
  const [mood, setMood] = useState("Dramatic");
  const [subject, setSubject] = useState("Landscape");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  const generate = async () => {
    if (!topic.trim()) { Alert.alert("Input needed", "Describe what you want to create."); return; }
    if (!hasAiKey) {
      Alert.alert("API key required", "Please add your AI API key in Settings to generate prompts.", [
        { text: "Not now", style: "cancel" },
        { text: "Open Settings", onPress: () => router.push("/tools/settings" as any) },
      ]);
      return;
    }
    setLoading(true); setPrompt("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const message = await aiChat(
        apiKeys,
        [{ role: "user", content: `Create an AI image generation prompt for: "${topic}"\nStyle: ${style}\nMood: ${mood}\nSubject type: ${subject}\n\nGenerate a detailed, professional prompt that will produce stunning results.` }],
        "You are an expert AI image prompt engineer. Generate highly detailed, optimized prompts for AI image generators like Midjourney, DALL-E, and Stable Diffusion. Include style keywords, lighting, composition, and technical details. Output only the prompt, nothing else.",
      );
      if (message) { setPrompt(message); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
      else Alert.alert("Error", "Failed to generate prompt");
    } catch (e: any) { Alert.alert("Error", e?.message || "Connection failed"); }
    finally { setLoading(false); }
  };

  const savePrompt = () => {
    if (!prompt) return;
    setSaved(prev => [prompt, ...prev.slice(0, 9)]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Saved!", "Prompt saved to your collection.");
  };

  const ChipRow = ({ label, options, selected, onSelect }: { label: string; options: string[]; selected: string; onSelect: (v: string) => void }) => (
    <View style={styles.chipGroup}>
      <Text style={styles.chipLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {options.map(o => (
          <Pressable key={o} onPress={() => { onSelect(o); Haptics.selectionAsync(); }}
            style={[styles.chip, selected === o && styles.chipActive]}>
            <Text style={[styles.chipText, selected === o && { color: Colors.white }]}>{o}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      <ToolHeader title="AI Image Prompt" subtitle="Generate perfect prompts for AI art" accentColor="#7C3AED" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <View style={styles.heroCard}>
          <MaterialCommunityIcons name="image-filter-drama" size={32} color="#7C3AED" />
          <Text style={styles.heroTitle}>AI Art Prompt Generator</Text>
          <Text style={styles.heroSub}>Create detailed prompts for Midjourney, DALL-E & Stable Diffusion</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>What do you want to create?</Text>
          <TextInput
            style={styles.input}
            value={topic}
            onChangeText={setTopic}
            placeholder="e.g. a dragon flying over a futuristic city..."
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <ChipRow label="Art Style" options={STYLES} selected={style} onSelect={setStyle} />
        <ChipRow label="Mood" options={MOODS} selected={mood} onSelect={setMood} />
        <ChipRow label="Subject" options={SUBJECTS} selected={subject} onSelect={setSubject} />

        <Pressable
          onPress={generate}
          disabled={!topic.trim() || loading}
          style={({ pressed }) => [styles.generateBtn, { opacity: !topic.trim() || loading || pressed ? 0.7 : 1 }]}
        >
          {loading ? <ActivityIndicator size="small" color={Colors.white} /> : <MaterialCommunityIcons name="magic-staff" size={20} color={Colors.white} />}
          <Text style={styles.generateBtnText}>{loading ? "Generating..." : "Generate Prompt"}</Text>
        </Pressable>

        {prompt ? (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>✨ Your AI Prompt</Text>
              <View style={styles.resultActions}>
                <Pressable onPress={savePrompt} style={styles.actionBtn}>
                  <Ionicons name="bookmark-outline" size={18} color={Colors.primary} />
                </Pressable>
                <Pressable onPress={generate} style={styles.actionBtn}>
                  <Ionicons name="refresh" size={18} color={Colors.primary} />
                </Pressable>
              </View>
            </View>
            <Text style={styles.promptText} selectable>{prompt}</Text>
            <Text style={styles.promptNote}>Copy this prompt and paste it into Midjourney, DALL-E 3, or Stable Diffusion</Text>
          </View>
        ) : null}

        {saved.length > 0 && (
          <View style={styles.savedCard}>
            <View style={styles.savedHeader}>
              <Ionicons name="bookmark" size={16} color="#7C3AED" />
              <Text style={styles.savedTitle}>Saved Prompts ({saved.length})</Text>
            </View>
            {saved.map((p, i) => (
              <Pressable key={i} onPress={() => setPrompt(p)} style={styles.savedItem}>
                <Text style={styles.savedItemText} numberOfLines={2}>{p}</Text>
                <Pressable onPress={() => setSaved(prev => prev.filter((_, idx) => idx !== i))} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                </Pressable>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const CARD_SHADOW = { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 14 },
  heroCard: { backgroundColor: "#F3EEFF", borderRadius: 20, padding: 20, alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#DDD6FE" },
  heroTitle: { fontFamily: "Poppins_700Bold", fontSize: 18, color: Colors.text },
  heroSub: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textSecondary, textAlign: "center" },
  card: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: Colors.cardBorder, ...CARD_SHADOW },
  label: { fontFamily: "Poppins_500Medium", fontSize: 11, color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.6 },
  input: { fontFamily: "Poppins_400Regular", fontSize: 15, color: Colors.text, minHeight: 80, lineHeight: 24, backgroundColor: Colors.separator, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.cardBorder },
  chipGroup: { gap: 8 },
  chipLabel: { fontFamily: "Poppins_500Medium", fontSize: 11, color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.6 },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.cardBorder },
  chipActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
  chipText: { fontFamily: "Poppins_500Medium", fontSize: 12, color: Colors.textSecondary },
  generateBtn: { backgroundColor: "#7C3AED", borderRadius: 14, height: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  generateBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 16, color: Colors.white },
  resultCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, gap: 12, borderWidth: 1.5, borderColor: "#7C3AED", ...CARD_SHADOW },
  resultHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: "#7C3AED" },
  resultActions: { flexDirection: "row", gap: 8 },
  actionBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.primaryLight, justifyContent: "center", alignItems: "center" },
  promptText: { fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.text, lineHeight: 24, borderTopWidth: 1, borderTopColor: Colors.separator, paddingTop: 12 },
  promptNote: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textMuted, fontStyle: "italic" },
  savedCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: Colors.cardBorder, ...CARD_SHADOW },
  savedHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  savedTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: "#7C3AED" },
  savedItem: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, backgroundColor: "#F3EEFF", borderRadius: 10 },
  savedItemText: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.text, flex: 1, lineHeight: 18 },
});
