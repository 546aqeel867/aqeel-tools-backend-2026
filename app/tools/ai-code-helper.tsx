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

const LANGS = ["JavaScript", "Python", "TypeScript", "React", "SQL", "Java", "C++", "Swift", "Kotlin", "PHP"];
const TASKS = [
  { label: "Write Code", icon: "code-tags", prompt: "Write clean, well-commented code for" },
  { label: "Debug", icon: "bug-outline", prompt: "Find and fix bugs in this code:" },
  { label: "Explain", icon: "lightbulb-outline", prompt: "Explain this code in simple terms:" },
  { label: "Optimize", icon: "speedometer-medium", prompt: "Optimize this code for performance:" },
  { label: "Refactor", icon: "refresh", prompt: "Refactor this code to be cleaner:" },
  { label: "Review", icon: "eye-outline", prompt: "Review this code and suggest improvements:" },
];

export default function AICodeHelper() {
  const insets = useSafeAreaInsets();
  const { apiKeys, hasAiKey } = useApp();
  const [input, setInput] = useState("");
  const [lang, setLang] = useState("JavaScript");
  const [task, setTask] = useState(TASKS[0]);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  const run = async () => {
    if (!input.trim()) { Alert.alert("Input needed", "Enter your code or question."); return; }
    if (!hasAiKey) {
      Alert.alert("API key required", "Please add your AI API key in Settings to use the code helper.", [
        { text: "Not now", style: "cancel" },
        { text: "Open Settings", onPress: () => router.push("/tools/settings" as any) },
      ]);
      return;
    }
    setLoading(true); setResult("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const message = await aiChat(
        apiKeys,
        [{ role: "user", content: `${task.prompt}:\n\nLanguage: ${lang}\n\n${input}` }],
        `You are an expert ${lang} developer and code assistant. Provide clear, practical code solutions with explanations. Format code with proper indentation. Be concise but thorough.`,
      );
      if (message) {
        setResult(message);
        setHistory(prev => [{ q: input.slice(0, 60), a: message }, ...prev.slice(0, 9)]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else Alert.alert("Error", "Failed");
    } catch (e: any) { Alert.alert("Error", e?.message || "Connection failed"); }
    finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
      <ToolHeader title="AI Code Helper" subtitle="Write, debug & explain code with AI" accentColor="#0891B2" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <View style={styles.heroCard}>
          <MaterialCommunityIcons name="code-braces" size={32} color="#0891B2" />
          <Text style={styles.heroTitle}>AI Code Assistant</Text>
          <Text style={styles.heroSub}>Write, debug, explain and optimize code in 10+ languages</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Task</Text>
          <View style={styles.taskGrid}>
            {TASKS.map(t => (
              <Pressable key={t.label} onPress={() => { setTask(t); Haptics.selectionAsync(); }}
                style={[styles.taskBtn, task.label === t.label && styles.taskBtnActive]}>
                <MaterialCommunityIcons name={t.icon as any} size={16} color={task.label === t.label ? Colors.white : "#0891B2"} />
                <Text style={[styles.taskBtnText, task.label === t.label && { color: Colors.white }]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Language</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {LANGS.map(l => (
              <Pressable key={l} onPress={() => { setLang(l); Haptics.selectionAsync(); }}
                style={[styles.chip, lang === l && styles.chipActive]}>
                <Text style={[styles.chipText, lang === l && { color: Colors.white }]}>{l}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{task.label === "Write Code" ? "Describe what to build" : "Paste your code / question"}</Text>
          <TextInput
            style={styles.codeInput}
            value={input}
            onChangeText={setInput}
            placeholder={task.label === "Write Code" ? "e.g. A function that sorts an array and removes duplicates..." : "Paste code or describe your issue..."}
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <Pressable
          onPress={run}
          disabled={!input.trim() || loading}
          style={({ pressed }) => [styles.runBtn, { opacity: !input.trim() || loading || pressed ? 0.7 : 1 }]}
        >
          {loading ? <ActivityIndicator size="small" color={Colors.white} /> : <MaterialCommunityIcons name="code-tags" size={20} color={Colors.white} />}
          <Text style={styles.runBtnText}>{loading ? "Processing..." : `${task.label} with AI`}</Text>
        </Pressable>

        {result ? (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>💻 Result</Text>
              <Pressable onPress={() => { setInput(""); setResult(""); }} style={styles.clearBtn}>
                <Ionicons name="refresh" size={16} color="#0891B2" />
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <Text style={styles.resultText} selectable>{result}</Text>
            </ScrollView>
          </View>
        ) : null}

        {history.length > 0 && (
          <View style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <Ionicons name="time-outline" size={16} color="#0891B2" />
              <Text style={styles.historyTitle}>Recent ({history.length})</Text>
              <Pressable onPress={() => setHistory([])} style={{ marginLeft: "auto" }}>
                <Text style={styles.clearAllText}>Clear all</Text>
              </Pressable>
            </View>
            {history.map((h, i) => (
              <Pressable key={i} onPress={() => setResult(h.a)} style={styles.historyItem}>
                <Ionicons name="code-slash" size={14} color={Colors.textMuted} />
                <Text style={styles.historyQ} numberOfLines={1}>{h.q}</Text>
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
  heroCard: { backgroundColor: "#F0FDFF", borderRadius: 20, padding: 20, alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#A5F3FC" },
  heroTitle: { fontFamily: "Poppins_700Bold", fontSize: 18, color: Colors.text },
  heroSub: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textSecondary, textAlign: "center" },
  card: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: Colors.cardBorder, ...CARD_SHADOW },
  label: { fontFamily: "Poppins_500Medium", fontSize: 11, color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.6 },
  taskGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  taskBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: "#F0FDFF", borderWidth: 1, borderColor: "#A5F3FC" },
  taskBtnActive: { backgroundColor: "#0891B2", borderColor: "#0891B2" },
  taskBtnText: { fontFamily: "Poppins_500Medium", fontSize: 12, color: "#0891B2" },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.separator, borderWidth: 1, borderColor: Colors.cardBorder },
  chipActive: { backgroundColor: "#0891B2", borderColor: "#0891B2" },
  chipText: { fontFamily: "Poppins_500Medium", fontSize: 12, color: Colors.textSecondary },
  codeInput: { fontFamily: "Poppins_400Regular", fontSize: 13, minHeight: 120, lineHeight: 22, backgroundColor: "#0F172A", borderRadius: 10, padding: 14, color: "#E2E8F0", borderWidth: 1, borderColor: "#1E293B" },
  runBtn: { backgroundColor: "#0891B2", borderRadius: 14, height: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, shadowColor: "#0891B2", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  runBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 16, color: Colors.white },
  resultCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, gap: 12, borderWidth: 1.5, borderColor: "#0891B2", ...CARD_SHADOW },
  resultHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: "#0891B2" },
  clearBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#F0FDFF", justifyContent: "center", alignItems: "center" },
  resultText: { fontFamily: "Poppins_400Regular", fontSize: 13, color: Colors.text, lineHeight: 22, borderTopWidth: 1, borderTopColor: Colors.separator, paddingTop: 12 },
  historyCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: Colors.cardBorder, ...CARD_SHADOW },
  historyHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  historyTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: "#0891B2" },
  clearAllText: { fontFamily: "Poppins_400Regular", fontSize: 11, color: "#DC2626" },
  historyItem: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, backgroundColor: "#F0FDFF", borderRadius: 8 },
  historyQ: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.text, flex: 1 },
});
