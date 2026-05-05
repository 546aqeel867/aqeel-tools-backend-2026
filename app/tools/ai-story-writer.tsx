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

const GENRES = ["Fantasy", "Sci-Fi", "Mystery", "Romance", "Horror", "Adventure", "Thriller", "Comedy"];
const LENGTHS = [
  { label: "Short (1 para)", value: "a short paragraph" },
  { label: "Medium (3 para)", value: "3 paragraphs" },
  { label: "Long (5 para)", value: "5 paragraphs" },
];
const TONES = ["Dramatic", "Humorous", "Dark", "Inspirational", "Mysterious", "Epic", "Romantic"];

export default function AIStoryWriter() {
  const insets = useSafeAreaInsets();
  const { apiKeys, hasAiKey } = useApp();
  const [idea, setIdea] = useState("");
  const [genre, setGenre] = useState("Fantasy");
  const [tone, setTone] = useState("Epic");
  const [length, setLength] = useState(LENGTHS[1]);
  const [story, setStory] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedStories, setSavedStories] = useState<{ title: string; text: string }[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  const generate = async () => {
    if (!idea.trim()) { Alert.alert("Input needed", "Enter your story idea first."); return; }
    if (!hasAiKey) {
      Alert.alert("API key required", "Please add your AI API key in Settings to generate stories.", [
        { text: "Not now", style: "cancel" },
        { text: "Open Settings", onPress: () => router.push("/tools/settings" as any) },
      ]);
      return;
    }
    setLoading(true); setStory("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const message = await aiChat(
        apiKeys,
        [{ role: "user", content: `Write ${length.value} of a ${genre} story with a ${tone} tone.\n\nStory idea: "${idea}"\n\nMake it captivating and immersive!` }],
        "You are a creative fiction author. Write engaging, vivid, well-structured stories. Use rich descriptions, dialogue, and compelling narrative arcs.",
      );
      if (message) { setStory(message); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
      else Alert.alert("Error", "Failed to generate story");
    } catch (e: any) { Alert.alert("Error", e?.message || "Connection failed"); }
    finally { setLoading(false); }
  };

  const saveStory = () => {
    if (!story) return;
    const title = idea.slice(0, 40) + (idea.length > 40 ? "..." : "");
    setSavedStories(prev => [{ title, text: story }, ...prev.slice(0, 9)]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Saved!", "Story saved to your library.");
  };

  const deleteStory = (i: number) => setSavedStories(prev => prev.filter((_, idx) => idx !== i));

  const ChipRow = ({ options, selected, onSelect }: { options: string[]; selected: string; onSelect: (v: string) => void }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {options.map(o => (
        <Pressable key={o} onPress={() => { onSelect(o); Haptics.selectionAsync(); }}
          style={[styles.chip, selected === o && styles.chipActive]}>
          <Text style={[styles.chipText, selected === o && { color: Colors.white }]}>{o}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <ToolHeader title="AI Story Writer" subtitle="Generate creative stories instantly" accentColor="#EA580C" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <View style={styles.heroCard}>
          <MaterialCommunityIcons name="book-open-variant" size={32} color="#EA580C" />
          <Text style={styles.heroTitle}>Creative Story Generator</Text>
          <Text style={styles.heroSub}>Turn your ideas into full stories with Zeno.V2 AI</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Your Story Idea</Text>
          <TextInput
            style={styles.input}
            value={idea}
            onChangeText={setIdea}
            placeholder="e.g. A detective discovers she can read minds..."
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Genre</Text>
          <ChipRow options={GENRES} selected={genre} onSelect={setGenre} />
          <Text style={[styles.label, { marginTop: 8 }]}>Tone</Text>
          <ChipRow options={TONES} selected={tone} onSelect={setTone} />
          <Text style={[styles.label, { marginTop: 8 }]}>Length</Text>
          <View style={styles.lengthRow}>
            {LENGTHS.map(l => (
              <Pressable key={l.label} onPress={() => { setLength(l); Haptics.selectionAsync(); }}
                style={[styles.lengthBtn, length.label === l.label && styles.lengthBtnActive]}>
                <Text style={[styles.lengthBtnText, length.label === l.label && { color: Colors.white }]}>{l.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          onPress={generate}
          disabled={!idea.trim() || loading}
          style={({ pressed }) => [styles.generateBtn, { opacity: !idea.trim() || loading || pressed ? 0.7 : 1 }]}
        >
          {loading ? <ActivityIndicator size="small" color={Colors.white} /> : <Ionicons name="pencil" size={20} color={Colors.white} />}
          <Text style={styles.generateBtnText}>{loading ? "Writing story..." : "Write My Story"}</Text>
        </Pressable>

        {story ? (
          <View style={styles.storyCard}>
            <View style={styles.storyHeader}>
              <Text style={styles.storyTitle}>📖 Your Story</Text>
              <View style={styles.storyActions}>
                <Pressable onPress={saveStory} style={styles.actionBtn}>
                  <Ionicons name="bookmark-outline" size={18} color="#EA580C" />
                </Pressable>
                <Pressable onPress={generate} style={styles.actionBtn}>
                  <Ionicons name="refresh" size={18} color="#EA580C" />
                </Pressable>
              </View>
            </View>
            <Text style={styles.storyText} selectable>{story}</Text>
          </View>
        ) : null}

        {savedStories.length > 0 && (
          <View style={styles.savedCard}>
            <Pressable onPress={() => setShowSaved(!showSaved)} style={styles.savedToggle}>
              <View style={styles.savedHeader}>
                <Ionicons name="library-outline" size={16} color="#EA580C" />
                <Text style={styles.savedTitle}>My Story Library ({savedStories.length})</Text>
              </View>
              <Ionicons name={showSaved ? "chevron-up" : "chevron-down"} size={18} color={Colors.textSecondary} />
            </Pressable>
            {showSaved && savedStories.map((s, i) => (
              <View key={i} style={styles.savedItem}>
                <Pressable onPress={() => setStory(s.text)} style={{ flex: 1 }}>
                  <Text style={styles.savedItemTitle}>{s.title}</Text>
                  <Text style={styles.savedItemPreview} numberOfLines={2}>{s.text}</Text>
                </Pressable>
                <Pressable onPress={() => deleteStory(i)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                </Pressable>
              </View>
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
  heroCard: { backgroundColor: "#FFF7ED", borderRadius: 20, padding: 20, alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#FED7AA" },
  heroTitle: { fontFamily: "Poppins_700Bold", fontSize: 18, color: Colors.text },
  heroSub: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textSecondary, textAlign: "center" },
  card: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: Colors.cardBorder, ...CARD_SHADOW },
  label: { fontFamily: "Poppins_500Medium", fontSize: 11, color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.6 },
  input: { fontFamily: "Poppins_400Regular", fontSize: 15, color: Colors.text, minHeight: 80, lineHeight: 24, backgroundColor: Colors.separator, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.cardBorder },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.separator, borderWidth: 1, borderColor: Colors.cardBorder },
  chipActive: { backgroundColor: "#EA580C", borderColor: "#EA580C" },
  chipText: { fontFamily: "Poppins_500Medium", fontSize: 12, color: Colors.textSecondary },
  lengthRow: { flexDirection: "row", gap: 8 },
  lengthBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.separator, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: "center" },
  lengthBtnActive: { backgroundColor: "#EA580C", borderColor: "#EA580C" },
  lengthBtnText: { fontFamily: "Poppins_500Medium", fontSize: 11, color: Colors.textSecondary },
  generateBtn: { backgroundColor: "#EA580C", borderRadius: 14, height: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, shadowColor: "#EA580C", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  generateBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 16, color: Colors.white },
  storyCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, gap: 12, borderWidth: 1.5, borderColor: "#EA580C", ...CARD_SHADOW },
  storyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  storyTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: "#EA580C" },
  storyActions: { flexDirection: "row", gap: 8 },
  actionBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#FFF7ED", justifyContent: "center", alignItems: "center" },
  storyText: { fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.text, lineHeight: 26, borderTopWidth: 1, borderTopColor: Colors.separator, paddingTop: 12 },
  savedCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: Colors.cardBorder, ...CARD_SHADOW },
  savedToggle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  savedHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  savedTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: "#EA580C" },
  savedItem: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, backgroundColor: "#FFF7ED", borderRadius: 10 },
  savedItemTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: Colors.text, marginBottom: 2 },
  savedItemPreview: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },
});
