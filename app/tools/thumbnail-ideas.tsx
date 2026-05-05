import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Platform, Alert, ActivityIndicator, Clipboard, Animated,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ToolHeader from "@/components/ToolHeader";
import { Colors } from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";
import { getApiUrl } from "@/lib/query-client";

const ACCENT = "#FF0000";
const ACCENT_LIGHT = "#FFF0F0";

interface ThumbnailIdea {
  id: string;
  title: string;
  layout: string;
  colors: string;
  text: string;
  visualElements: string;
  emotion: string;
  tip: string;
}

const NICHES = [
  { id: "tech",      label: "Tech",        emoji: "💻" },
  { id: "gaming",    label: "Gaming",      emoji: "🎮" },
  { id: "fitness",   label: "Fitness",     emoji: "💪" },
  { id: "cooking",   label: "Cooking",     emoji: "🍳" },
  { id: "finance",   label: "Finance",     emoji: "💰" },
  { id: "travel",    label: "Travel",      emoji: "✈️" },
  { id: "education", label: "Education",   emoji: "📚" },
  { id: "lifestyle", label: "Lifestyle",   emoji: "🌟" },
  { id: "music",     label: "Music",       emoji: "🎵" },
  { id: "business",  label: "Business",    emoji: "📈" },
];

const STYLES = [
  { id: "bold_text",    label: "Bold Text",     emoji: "🅱️", desc: "Large impactful text dominates" },
  { id: "face_reaction",label: "Face Reaction",  emoji: "😱", desc: "Close-up shocked/excited face" },
  { id: "before_after", label: "Before/After",   emoji: "↔️", desc: "Split comparison layout" },
  { id: "numbered",     label: "Numbered List",  emoji: "🔢", desc: "3 or 5 steps/secrets shown" },
  { id: "curiosity",    label: "Curiosity Gap",  emoji: "❓", desc: "Blur or hide part of the image" },
  { id: "minimalist",   label: "Minimalist",     emoji: "⬜", desc: "Clean, simple, one focal point" },
];

const OFFLINE_IDEAS: ThumbnailIdea[] = [
  {
    id: "1",
    title: "Bold Statement Thumbnail",
    layout: "Large bold text on left (60% of frame), creator face on right looking surprised/excited",
    colors: "Deep red (#CC0000) background with white bold text. Yellow accent for numbers.",
    text: "HUGE TEXT: 3 words max. e.g. 'I WAS WRONG' or 'THIS CHANGED EVERYTHING'",
    visualElements: "Creator photo (chest up), arrow pointing to text, subtle vignette edges",
    emotion: "Shock, surprise, disbelief — wide eyes, open mouth",
    tip: "The most clicked thumbnail style on YouTube. Works for any niche. Keep text under 5 words.",
  },
  {
    id: "2",
    title: "Before & After Split",
    layout: "50/50 vertical split. LEFT = 'before' (sad/bad), RIGHT = 'after' (happy/great). Arrow in center.",
    colors: "Left side: desaturated/grey. Right side: warm vibrant colors. High contrast.",
    text: "'BEFORE' in grey, 'AFTER' in bright yellow. Keep text minimal.",
    visualElements: "Transformation photos, double-headed arrow, checkmark on right side",
    emotion: "Hope, transformation, aspiration — visible difference between sides",
    tip: "Great for tutorials, reviews, makeovers, and any transformation content.",
  },
  {
    id: "3",
    title: "Numbered Secrets",
    layout: "Big number (3, 5, 7) on left in circle, title text on right, subject image in background",
    colors: "Bright background (orange/blue/purple), white number circle, bold white text",
    text: "e.g. '5 MISTAKES', '7 SECRETS', '3 TIPS'. Number should be visually dominant.",
    visualElements: "Large circle with number, stacked text lines, subtle background subject image",
    emotion: "Curiosity, FOMO — viewers want to know ALL the secrets",
    tip: "Odd numbers (3, 5, 7) outperform even numbers. '5' is the sweet spot.",
  },
  {
    id: "4",
    title: "Curiosity Gap / Mystery",
    layout: "Subject or result partially hidden/blurred, question text overlay, creator pointing at hidden area",
    colors: "Dark background with spotlight effect on the reveal area, bright question text",
    text: "Questions that demand clicks: 'What happened?', 'You won't believe this', 'Can you spot it?'",
    visualElements: "Blurred or covered area, pointing gesture, question mark elements",
    emotion: "Intense curiosity — the brain needs to resolve the incomplete information",
    tip: "Make sure the video ACTUALLY answers the question. Clickbait without payoff destroys trust.",
  },
  {
    id: "5",
    title: "Clean Minimalist",
    layout: "Single high-quality image center, small clean text overlay at bottom or top. Lots of breathing room.",
    colors: "Clean white or light background, single accent color, minimal text in clean font",
    text: "Short, clean title. 1-2 lines max. Use a modern, readable font.",
    visualElements: "Professional photo or product shot, clean typography, no clutter",
    emotion: "Premium, trustworthy, authoritative — less is more",
    tip: "Works best for educational, finance, and professional channels. Builds brand trust.",
  },
  {
    id: "6",
    title: "Viral Face Reaction",
    layout: "Creator's face takes 70-80% of frame. Extreme reaction expression. Small text on side/bottom.",
    colors: "Bright contrasting background (avoid white — use bright blue, green, orange). Clean edges.",
    text: "Max 3 words. Should complement the face expression. e.g. 'NO WAY...' '😱 IT WORKS!'",
    visualElements: "High-quality face photo, bright solid background, minimal props only if needed",
    emotion: "Mirroring — viewers subconsciously mimic the emotion they see. Use extreme emotions.",
    tip: "Rehearse multiple expressions and choose the most extreme/genuine one. Eyes must be visible.",
  },
];

function IdeaCard({ idea, platform }: { idea: ThumbnailIdea; platform: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyIdea = async () => {
    const text = `THUMBNAIL IDEA: ${idea.title}
📐 Layout: ${idea.layout}
🎨 Colors: ${idea.colors}
📝 Text: ${idea.text}
🖼️ Visual Elements: ${idea.visualElements}
😮 Emotion: ${idea.emotion}
💡 Pro Tip: ${idea.tip}`;
    await Clipboard.setString(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <Pressable onPress={() => { setExpanded(!expanded); Haptics.selectionAsync(); }} style={s.ideaCard}>
      <View style={s.ideaCardHeader}>
        <View style={s.ideaNum}>
          <MaterialCommunityIcons name="youtube" size={14} color={ACCENT} />
        </View>
        <Text style={s.ideaTitle} numberOfLines={expanded ? undefined : 1}>{idea.title}</Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={Colors.textSecondary} />
      </View>

      {!expanded && (
        <Text style={s.ideaPreview} numberOfLines={2}>{idea.layout}</Text>
      )}

      {expanded && (
        <View style={{ gap: 10, marginTop: 6 }}>
          <DetailRow icon="grid-outline" label="Layout" value={idea.layout} color="#2563EB" />
          <DetailRow icon="color-palette-outline" label="Colors" value={idea.colors} color="#7C3AED" />
          <DetailRow icon="text-outline" label="Text Strategy" value={idea.text} color="#059669" />
          <DetailRow icon="image-outline" label="Visual Elements" value={idea.visualElements} color="#0891B2" />
          <DetailRow icon="happy-outline" label="Emotion to Convey" value={idea.emotion} color="#DB2777" />
          <View style={s.tipCard}>
            <Ionicons name="bulb-outline" size={16} color="#D97706" />
            <Text style={s.tipText}>{idea.tip}</Text>
          </View>
          <Pressable onPress={copyIdea} style={[s.copyBtn, copied && { backgroundColor: "#059669" }]}>
            <Ionicons name={copied ? "checkmark" : "copy-outline"} size={14} color={Colors.white} />
            <Text style={s.copyBtnText}>{copied ? "Copied!" : "Copy Full Brief"}</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

function DetailRow({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={s.detailRow}>
      <View style={[s.detailIcon, { backgroundColor: color + "15" }]}>
        <Ionicons name={icon as any} size={14} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.detailLabel, { color }]}>{label}</Text>
        <Text style={s.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function ThumbnailIdeasScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { apiKeys, hasAiKey } = useApp();

  const [videoTitle, setVideoTitle] = useState("");
  const [niche, setNiche] = useState(NICHES[0]);
  const [style, setStyle] = useState(STYLES[0]);
  const [target, setTarget] = useState("");
  const [ideas, setIdeas] = useState<ThumbnailIdea[]>([]);
  const [loading, setLoading] = useState(false);

  function uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

  const generate = useCallback(async () => {
    if (!videoTitle.trim()) {
      Alert.alert("Add a video title", "Enter your video title or topic to get thumbnail ideas.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    if (hasAiKey) {
      try {
        const prompt = `You are an expert YouTube thumbnail designer and conversion rate optimizer.

Generate 4 specific, detailed YouTube thumbnail ideas for this video:
Title: "${videoTitle}"
Niche: ${niche.label}
Preferred Style: ${style.label} — ${style.desc}
Target Audience: ${target || "general YouTube viewers"}

For each idea, respond in EXACTLY this JSON array format (no extra text before or after):
[
  {
    "id": "1",
    "title": "Thumbnail concept name",
    "layout": "Detailed layout description",
    "colors": "Specific color palette with hex codes",
    "text": "Exactly what text to use on the thumbnail",
    "visualElements": "Specific visual elements, props, overlays",
    "emotion": "Emotional reaction to convey and how",
    "tip": "One specific pro tip for this concept"
  }
]`;

        const resp = await fetch(new URL("/api/ai/chat", getApiUrl()).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: prompt }],
            apiKey: apiKeys.openrouterKey || apiKeys.huggingfaceKey,
            model: "meta-llama/llama-3.1-8b-instruct:free",
          }),
        });
        if (resp.ok) {
          const json = await resp.json();
          const raw = json.message || "";
          const match = raw.match(/\[[\s\S]*\]/);
          if (match) {
            const parsed = JSON.parse(match[0]) as ThumbnailIdea[];
            if (parsed?.length > 0) { setIdeas(parsed); setLoading(false); return; }
          }
        }
      } catch {}
    }

    // Offline: use pre-built ideas with customized titles
    const customized = OFFLINE_IDEAS.map((idea) => ({
      ...idea,
      id: uid(),
      text: idea.text.replace("e.g.", `for "${videoTitle}" e.g.`),
    }));
    setIdeas(customized.slice(0, 5));
    setLoading(false);
  }, [videoTitle, niche, style, target, hasAiKey, apiKeys]);

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <ToolHeader
        title="Thumbnail Ideas"
        subtitle="AI-powered YouTube thumbnail concepts"
        accentColor={ACCENT}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Video Title */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Video Title / Topic</Text>
          <TextInput
            style={s.titleInput}
            value={videoTitle}
            onChangeText={setVideoTitle}
            placeholder="e.g. I Tried 30 Days of Cold Showers"
            placeholderTextColor={Colors.textMuted}
            multiline
          />
        </View>

        {/* Niche */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Your Niche</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {NICHES.map((n) => (
              <Pressable key={n.id} onPress={() => { Haptics.selectionAsync(); setNiche(n); }} style={[s.nicheChip, niche.id === n.id && s.nicheChipOn]}>
                <Text style={s.nicheEmoji}>{n.emoji}</Text>
                <Text style={[s.nicheText, niche.id === n.id && { color: ACCENT }]}>{n.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Style */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Thumbnail Style</Text>
          <View style={s.styleGrid}>
            {STYLES.map((st) => (
              <Pressable key={st.id} onPress={() => { Haptics.selectionAsync(); setStyle(st); }} style={[s.styleCard, style.id === st.id && s.styleCardOn]}>
                <Text style={s.styleEmoji}>{st.emoji}</Text>
                <Text style={[s.styleLabel, style.id === st.id && { color: ACCENT }]}>{st.label}</Text>
                <Text style={s.styleDesc} numberOfLines={2}>{st.desc}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Target Audience */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Target Audience (optional)</Text>
          <TextInput
            style={s.targetInput}
            value={target}
            onChangeText={setTarget}
            placeholder="e.g. beginners, entrepreneurs, teens, gamers"
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        {/* Generate */}
        <Pressable onPress={generate} disabled={loading} style={[s.generateBtn, loading && { opacity: 0.7 }]}>
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <MaterialCommunityIcons name="youtube" size={20} color={Colors.white} />
              <Text style={s.generateBtnText}>Generate Thumbnail Ideas</Text>
            </>
          )}
        </Pressable>
        {!hasAiKey && (
          <Text style={s.offlineNote}>Using offline ideas. Add an AI key in Settings for custom AI-generated concepts.</Text>
        )}

        {/* Results */}
        {ideas.length > 0 && (
          <View style={s.resultsSection}>
            <View style={s.resultsHeader}>
              <MaterialCommunityIcons name="youtube" size={18} color={ACCENT} />
              <Text style={s.resultsTitle}>{ideas.length} Thumbnail Ideas</Text>
            </View>
            <Text style={s.resultsSub}>Tap each card to see the full creative brief</Text>
            {ideas.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} platform="youtube" />
            ))}
            <Pressable onPress={generate} style={s.regenerateBtn}>
              <Ionicons name="refresh" size={16} color={ACCENT} />
              <Text style={s.regenerateBtnText}>Generate New Ideas</Text>
            </Pressable>
          </View>
        )}

        {/* Tips */}
        <View style={s.tipsSection}>
          <Text style={s.tipsTitle}>🔥 YouTube Thumbnail Rules</Text>
          {[
            { rule: "Faces outperform no-faces by 38%", icon: "happy-outline" },
            { rule: "Bright, contrasting colors get 2x more clicks", icon: "color-palette-outline" },
            { rule: "Text should be readable at 120px thumbnail size", icon: "text-outline" },
            { rule: "Match the emotional promise of your video title", icon: "heart-outline" },
            { rule: "Test 2 thumbnails with YouTube's A/B test feature", icon: "git-branch-outline" },
            { rule: "Avoid clutter — one clear focal point only", icon: "eye-outline" },
          ].map((t, i) => (
            <View key={i} style={s.ruleRow}>
              <View style={s.ruleIcon}>
                <Ionicons name={t.icon as any} size={14} color={ACCENT} />
              </View>
              <Text style={s.ruleText}>{t.rule}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  section: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  sectionLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: Colors.text },
  titleInput: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, fontFamily: "Poppins_400Regular", fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.cardBorder, minHeight: 56 },
  nicheChip: { alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.separator, borderWidth: 1.5, borderColor: Colors.cardBorder, gap: 3 },
  nicheChipOn: { backgroundColor: ACCENT_LIGHT, borderColor: ACCENT },
  nicheEmoji: { fontSize: 18 },
  nicheText: { fontFamily: "Poppins_500Medium", fontSize: 11, color: Colors.textSecondary },
  styleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  styleCard: { width: "48%", backgroundColor: Colors.white, borderRadius: 14, padding: 12, gap: 4, borderWidth: 1.5, borderColor: Colors.cardBorder },
  styleCardOn: { backgroundColor: ACCENT_LIGHT, borderColor: ACCENT },
  styleEmoji: { fontSize: 22 },
  styleLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: Colors.text },
  styleDesc: { fontFamily: "Poppins_400Regular", fontSize: 10, color: Colors.textSecondary, lineHeight: 15 },
  targetInput: { backgroundColor: Colors.white, borderRadius: 12, padding: 12, fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.cardBorder },
  generateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: ACCENT, borderRadius: 16, paddingVertical: 16, marginHorizontal: 16, marginTop: 8 },
  generateBtnText: { fontFamily: "Poppins_700Bold", fontSize: 15, color: Colors.white },
  offlineNote: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textMuted, textAlign: "center", marginTop: 6, marginHorizontal: 16 },
  resultsSection: { marginHorizontal: 16, marginTop: 16, gap: 10 },
  resultsHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultsTitle: { fontFamily: "Poppins_700Bold", fontSize: 17, color: Colors.text },
  resultsSub: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: -4 },
  ideaCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.cardBorder, gap: 6 },
  ideaCardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  ideaNum: { width: 30, height: 30, borderRadius: 8, backgroundColor: ACCENT_LIGHT, justifyContent: "center", alignItems: "center" },
  ideaTitle: { fontFamily: "Poppins_700Bold", fontSize: 14, color: Colors.text, flex: 1 },
  ideaPreview: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.textSecondary, lineHeight: 19, marginLeft: 40 },
  detailRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  detailIcon: { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center", marginTop: 2 },
  detailLabel: { fontFamily: "Poppins_700Bold", fontSize: 11, marginBottom: 2 },
  detailValue: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.textSecondary, lineHeight: 19 },
  tipCard: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FFFBEB", borderRadius: 10, padding: 10 },
  tipText: { fontFamily: "Poppins_400Regular", fontSize: 12, color: "#92400E", flex: 1, lineHeight: 18 },
  copyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: ACCENT, borderRadius: 10, paddingVertical: 9 },
  copyBtnText: { fontFamily: "Poppins_700Bold", fontSize: 12, color: Colors.white },
  regenerateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 14, borderWidth: 1.5, borderColor: ACCENT, backgroundColor: ACCENT_LIGHT },
  regenerateBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: ACCENT },
  tipsSection: { marginHorizontal: 16, marginTop: 16, backgroundColor: Colors.white, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: Colors.cardBorder },
  tipsTitle: { fontFamily: "Poppins_700Bold", fontSize: 14, color: Colors.text, marginBottom: 4 },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  ruleIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: ACCENT_LIGHT, justifyContent: "center", alignItems: "center" },
  ruleText: { fontFamily: "Poppins_400Regular", fontSize: 13, color: Colors.textSecondary, flex: 1 },
});
