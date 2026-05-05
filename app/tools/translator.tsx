import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import ToolHeader from "@/components/ToolHeader";
import { useApp } from "@/contexts/AppContext";
import { aiTranslate } from "@/lib/ai";

const LANGUAGES = [
  { code: "English", flag: "🇬🇧" },
  { code: "Arabic", flag: "🇸🇦" },
  { code: "French", flag: "🇫🇷" },
  { code: "Spanish", flag: "🇪🇸" },
  { code: "German", flag: "🇩🇪" },
  { code: "Chinese", flag: "🇨🇳" },
  { code: "Japanese", flag: "🇯🇵" },
  { code: "Korean", flag: "🇰🇷" },
  { code: "Hindi", flag: "🇮🇳" },
  { code: "Urdu", flag: "🇵🇰" },
  { code: "Turkish", flag: "🇹🇷" },
  { code: "Russian", flag: "🇷🇺" },
  { code: "Portuguese", flag: "🇵🇹" },
  { code: "Italian", flag: "🇮🇹" },
  { code: "Dutch", flag: "🇳🇱" },
  { code: "Polish", flag: "🇵🇱" },
];

const LOCALE_MAP: Record<string, string> = {
  English: "en-US", Arabic: "ar-SA", French: "fr-FR", Spanish: "es-ES",
  German: "de-DE", Chinese: "zh-CN", Japanese: "ja-JP", Korean: "ko-KR",
  Hindi: "hi-IN", Urdu: "ur-PK", Turkish: "tr-TR", Russian: "ru-RU",
  Portuguese: "pt-PT", Italian: "it-IT", Dutch: "nl-NL", Polish: "pl-PL",
};

export default function Translator() {
  const insets = useSafeAreaInsets();
  const { apiKeys, hasAiKey } = useApp();
  const [inputText, setInputText] = useState("");
  const [translated, setTranslated] = useState("");
  const [fromLang, setFromLang] = useState("English");
  const [toLang, setToLang] = useState("Arabic");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  const translate = async () => {
    if (!inputText.trim()) { Alert.alert("Input Required", "Please enter text to translate."); return; }
    if (!hasAiKey) {
      Alert.alert("API key required", "Please add your AI API key in Settings to translate.", [
        { text: "Not now", style: "cancel" },
        { text: "Open Settings", onPress: () => router.push("/tools/settings" as any) },
      ]);
      return;
    }
    setLoading(true);
    setTranslated("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await aiTranslate(apiKeys, inputText.trim(), toLang, fromLang);
      if (result) {
        setTranslated(result);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert("Error", "Translation failed");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Connection failed. Please check your internet.");
    } finally {
      setLoading(false);
    }
  };

  const speakText = async (text: string, lang: string) => {
    if (!text.trim()) return;
    if (speaking) { Speech.stop(); setSpeaking(false); return; }
    setSpeaking(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Speech.speak(text, {
        language: LOCALE_MAP[lang] || "en-US",
        rate: 0.9,
        onDone: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      });
    } catch {
      setSpeaking(false);
    }
  };

  const swapLanguages = () => {
    Haptics.selectionAsync();
    const temp = fromLang;
    setFromLang(toLang);
    setToLang(temp);
    setInputText(translated);
    setTranslated("");
  };

  const LangPicker = ({ visible, selected, onSelect, onClose }: {
    visible: boolean; selected: string; onSelect: (l: string) => void; onClose: () => void;
  }) => {
    if (!visible) return null;
    return (
      <View style={styles.pickerOverlay}>
        <View style={styles.pickerCard}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Select Language</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={Colors.text} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
            {LANGUAGES.map((lang) => (
              <Pressable
                key={lang.code}
                onPress={() => { onSelect(lang.code); onClose(); Haptics.selectionAsync(); }}
                style={[styles.pickerItem, selected === lang.code && styles.pickerItemActive]}
              >
                <Text style={styles.pickerFlag}>{lang.flag}</Text>
                <Text style={[styles.pickerItemText, selected === lang.code && { color: Colors.primary }]}>
                  {lang.code}
                </Text>
                {selected === lang.code && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ToolHeader title="Translator" subtitle="AI-powered voice & text translation" accentColor="#7C3AED" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.langRow}>
          <Pressable
            onPress={() => { setShowFromPicker(true); setShowToPicker(false); }}
            style={styles.langBtn}
          >
            <Text style={styles.langFlag}>{LANGUAGES.find(l => l.code === fromLang)?.flag}</Text>
            <Text style={styles.langBtnText}>{fromLang}</Text>
            <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
          </Pressable>

          <Pressable onPress={swapLanguages} style={styles.swapBtn}>
            <Ionicons name="swap-horizontal" size={20} color={Colors.primary} />
          </Pressable>

          <Pressable
            onPress={() => { setShowToPicker(true); setShowFromPicker(false); }}
            style={styles.langBtn}
          >
            <Text style={styles.langFlag}>{LANGUAGES.find(l => l.code === toLang)?.flag}</Text>
            <Text style={styles.langBtnText}>{toLang}</Text>
            <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.inputCard}>
          <View style={styles.inputHeader}>
            <Text style={styles.inputLangLabel}>{fromLang}</Text>
            <Pressable onPress={() => speakText(inputText, fromLang)} style={styles.speakBtn} disabled={!inputText.trim()}>
              <Ionicons name="volume-medium-outline" size={20} color={inputText.trim() ? Colors.primary : Colors.textMuted} />
            </Pressable>
          </View>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Enter text to translate..."
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          {inputText.length > 0 && (
            <Pressable onPress={() => { setInputText(""); setTranslated(""); }} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </Pressable>
          )}
        </View>

        <Pressable
          onPress={translate}
          disabled={!inputText.trim() || loading}
          style={({ pressed }) => [
            styles.translateBtn,
            { opacity: !inputText.trim() || loading || pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <MaterialCommunityIcons name="translate" size={20} color={Colors.white} />
          )}
          <Text style={styles.translateBtnText}>{loading ? "Translating..." : `Translate to ${toLang}`}</Text>
        </Pressable>

        {translated ? (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.inputLangLabel}>{toLang}</Text>
              <Pressable onPress={() => speakText(translated, toLang)} style={styles.speakBtnActive}>
                <Ionicons
                  name={speaking ? "stop-circle" : "volume-high"}
                  size={20}
                  color={Colors.white}
                />
                <Text style={styles.speakBtnText}>{speaking ? "Stop" : "Listen"}</Text>
              </Pressable>
            </View>
            <Text style={styles.resultText} selectable>{translated}</Text>
          </View>
        ) : null}

        <View style={styles.tipsCard}>
          <Ionicons name="bulb-outline" size={16} color="#D97706" />
          <Text style={styles.tipsText}>
            Supports 16 languages. Tap the speaker icon to hear the translation aloud. Tap ⇄ to swap languages.
          </Text>
        </View>
      </ScrollView>

      <LangPicker
        visible={showFromPicker}
        selected={fromLang}
        onSelect={(l) => { setFromLang(l); setTranslated(""); }}
        onClose={() => setShowFromPicker(false)}
      />
      <LangPicker
        visible={showToPicker}
        selected={toLang}
        onSelect={(l) => { setToLang(l); setTranslated(""); }}
        onClose={() => setShowToPicker(false)}
      />
    </View>
  );
}

const CARD_SHADOW = {
  shadowColor: Colors.shadow,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.07,
  shadowRadius: 8,
  elevation: 2,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 14 },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  langBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...CARD_SHADOW,
  },
  langFlag: { fontSize: 20 },
  langBtnText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: Colors.text,
    flex: 1,
  },
  swapBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  inputCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...CARD_SHADOW,
  },
  inputHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  inputLangLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  speakBtn: {
    padding: 4,
  },
  textInput: {
    fontFamily: "Poppins_400Regular",
    fontSize: 16,
    color: Colors.text,
    minHeight: 100,
    lineHeight: 26,
  },
  clearBtn: {
    alignSelf: "flex-end",
    marginTop: 8,
  },
  translateBtn: {
    backgroundColor: "#7C3AED",
    borderRadius: 14,
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  translateBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: Colors.white,
  },
  resultCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#7C3AED",
    ...CARD_SHADOW,
    gap: 12,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  speakBtnActive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#7C3AED",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  speakBtnText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: Colors.white,
  },
  resultText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 16,
    color: Colors.text,
    lineHeight: 28,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
    paddingTop: 12,
  },
  tipsCard: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    backgroundColor: "#FFFBEB",
    borderRadius: 10,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  tipsText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: "#92400E",
    flex: 1,
    lineHeight: 17,
  },
  pickerOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
    padding: 24,
  },
  pickerCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxHeight: 420,
    ...CARD_SHADOW,
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  pickerTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: Colors.text,
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  pickerItemActive: { backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 10 },
  pickerFlag: { fontSize: 22 },
  pickerItemText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
});
