import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Platform, Alert, ActivityIndicator, Clipboard,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ToolHeader from "@/components/ToolHeader";
import { Colors } from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";
import { getApiUrl } from "@/lib/query-client";

const ACCENT = "#7C3AED";
const ACCENT_LIGHT = "#F3EEFF";
const STORE_KEY = "bio_generator_v1";

interface Platform2 {
  id: string; label: string; icon: string; iconLib: "ionicons" | "community";
  color: string; bg: string;
  charLimit: number; tip: string;
}

const PLATFORMS: Platform2[] = [
  { id: "instagram", label: "Instagram",  icon: "logo-instagram",      iconLib: "ionicons",   color: "#E1306C", bg: "#FFF0F5", charLimit: 150, tip: "Include emojis, keywords & a call-to-action link in bio." },
  { id: "twitter",  label: "X / Twitter", icon: "logo-twitter",        iconLib: "ionicons",   color: "#1DA1F2", bg: "#E8F5FF", charLimit: 160, tip: "Keep it punchy. One-liners perform best." },
  { id: "linkedin", label: "LinkedIn",    icon: "logo-linkedin",       iconLib: "ionicons",   color: "#0A66C2", bg: "#E8F0FB", charLimit: 220, tip: "Be professional. Include your role, skills, and value proposition." },
  { id: "tiktok",   label: "TikTok",      icon: "musical-notes-outline",iconLib: "ionicons",  color: "#010101", bg: "#F5F5F5", charLimit: 80,  tip: "Ultra short. What you post + personality in one line." },
  { id: "youtube",  label: "YouTube",     icon: "logo-youtube",        iconLib: "ionicons",   color: "#FF0000", bg: "#FFF0F0", charLimit: 1000,tip: "Tell viewers what your channel is about and when you post." },
  { id: "github",   label: "GitHub",      icon: "logo-github",         iconLib: "ionicons",   color: "#24292E", bg: "#F6F8FA", charLimit: 160, tip: "Show your tech stack and what you build. Link projects." },
  { id: "general",  label: "General",     icon: "person-circle-outline",iconLib: "ionicons",  color: "#7C3AED", bg: "#F3EEFF", charLimit: 300, tip: "All-purpose professional bio for websites and portfolios." },
];

const TONES = [
  { id: "professional", label: "Professional", emoji: "💼" },
  { id: "casual",       label: "Casual",       emoji: "😊" },
  { id: "funny",        label: "Funny",        emoji: "😄" },
  { id: "inspirational",label: "Inspiring",    emoji: "🌟" },
  { id: "creative",     label: "Creative",     emoji: "🎨" },
  { id: "minimal",      label: "Minimal",      emoji: "✨" },
];

const EMOJI_STYLES = [
  { id: "none",   label: "No Emoji" },
  { id: "few",    label: "A Few 🌟" },
  { id: "many",   label: "Lots 🎉🔥" },
];

const OFFLINE_BIOS: Record<string, string[]> = {
  instagram: [
    "{name} | {role} 🎯\n{interest1} enthusiast\n{interest2} creator\n📍 {location}\n👇 Latest work:",
    "✨ {name}\n{role} by day, {interest1} lover by night\n🌍 {location}\n📸 Capturing moments that matter",
    "Hey! I'm {name} 👋\n💡 {role}\n🎯 Passionate about {interest1}\n📬 DM for collabs!",
  ],
  twitter: [
    "{role} | Building things that matter | {interest1} nerd | Tweeting about {interest2} | {location}",
    "I {role} for a living. I think about {interest1} a lot. Sometimes I'm funny.",
    "{name} • {role} • Occasional thoughts on {interest1} and {interest2} • {location}",
  ],
  linkedin: [
    "{name} | {role} at {company}\n\nHelping organizations grow through {interest1}. Passionate about {interest2}.\n\nLet's connect if you're building something meaningful.",
    "Experienced {role} with a passion for {interest1}. I help teams achieve their goals through innovative approaches to {interest2}.",
    "{role} | {interest1} specialist | Open to new opportunities\n\nI believe great {interest2} is the foundation of every successful business.",
  ],
  tiktok: [
    "{name} | {role} | {interest1} content ✨",
    "Making {interest1} content | {role} | {location} 🎬",
    "{interest1} creator | {role} by day | {emoji} vibes only",
  ],
  youtube: [
    "Hey! I'm {name}, a {role} creating videos about {interest1} and {interest2}. New videos every week! Subscribe for tips, tutorials, and behind-the-scenes content.",
    "Welcome to my channel! I'm {name} — a {role} sharing everything I know about {interest1}. If you love {interest2}, you're in the right place!",
  ],
  github: [
    "{role} building {interest1} tools. Fan of {interest2}. Open source enthusiast.",
    "{name} | {role} | Passionate about {interest1} | Always learning {interest2}",
  ],
  general: [
    "{name} is a {role} specializing in {interest1}. With a passion for {interest2}, they create meaningful impact in their field. Based in {location}.",
    "Hi, I'm {name} — a {role} with deep expertise in {interest1}. I'm driven by {interest2} and committed to making a real difference.",
  ],
};

function fillTemplate(template: string, data: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => data[key] || key);
}

function getOfflineBio(platformId: string, data: Record<string, string>): string {
  const pool = OFFLINE_BIOS[platformId] || OFFLINE_BIOS.general;
  const template = pool[Math.floor(Math.random() * pool.length)];
  return fillTemplate(template, { ...data, emoji: "⚡" });
}

export default function BioGeneratorScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { apiKeys, hasAiKey } = useApp();

  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [tone, setTone] = useState(TONES[0]);
  const [emojiStyle, setEmojiStyle] = useState(EMOJI_STYLES[1]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [interest1, setInterest1] = useState("");
  const [interest2, setInterest2] = useState("");
  const [extraInfo, setExtraInfo] = useState("");
  const [bios, setBios] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const generateBios = useCallback(async () => {
    if (!name.trim() && !role.trim()) {
      Alert.alert("Add details", "Please enter at least your name or role to generate a bio.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    const data = { name: name || "Your Name", role: role || "Creator", company: company || "your company", location: location || "Worldwide", interest1: interest1 || "your passion", interest2: interest2 || "innovation" };

    if (hasAiKey) {
      try {
        const prompt = `Generate 3 unique, excellent ${platform.label} bios for the following person. Output ONLY the 3 bios separated by "---". No numbering, no labels.

Name: ${data.name}
Role/Profession: ${data.role}
Company: ${data.company}
Location: ${data.location}
Interests: ${data.interest1}, ${data.interest2}
Extra info: ${extraInfo || "none"}
Platform: ${platform.label}
Tone: ${tone.label}
Emoji style: ${emojiStyle.label}
Character limit: ${platform.charLimit}
Platform tip: ${platform.tip}

Keep each bio under ${platform.charLimit} characters. Make them distinct — vary structure and focus. Tone: ${tone.id}. ${emojiStyle.id === "many" ? "Use emojis generously." : emojiStyle.id === "few" ? "Use 2-3 emojis tastefully." : "No emojis."}`;

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
          const rawBios = json.message?.split("---").map((b: string) => b.trim()).filter(Boolean) || [];
          if (rawBios.length > 0) { setBios(rawBios); setLoading(false); return; }
        }
      } catch {}
    }

    // Offline fallback — generate 3 variants
    const offline = [
      getOfflineBio(platform.id, data),
      getOfflineBio(platform.id, { ...data, role: data.role + " & " + (data.interest1 || "creator") }),
      getOfflineBio(platform.id, data),
    ];
    setBios([...new Set(offline)].slice(0, 3));
    setLoading(false);
  }, [name, role, company, location, interest1, interest2, extraInfo, platform, tone, emojiStyle, hasAiKey, apiKeys]);

  const copyBio = async (bio: string, idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setString(bio);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <ToolHeader
        title="Bio Generator"
        subtitle="AI-crafted bios for every platform"
        accentColor={ACCENT}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Platform Picker */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Platform</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {PLATFORMS.map((p) => (
              <Pressable key={p.id} onPress={() => { Haptics.selectionAsync(); setPlatform(p); setBios([]); }} style={[s.platformChip, platform.id === p.id && { backgroundColor: p.bg, borderColor: p.color }]}>
                <Ionicons name={p.icon as any} size={16} color={platform.id === p.id ? p.color : Colors.textSecondary} />
                <Text style={[s.platformChipText, platform.id === p.id && { color: p.color }]}>{p.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={[s.platformTip, { backgroundColor: platform.bg }]}>
            <Ionicons name="bulb-outline" size={13} color={platform.color} />
            <Text style={[s.platformTipText, { color: platform.color }]}>{platform.tip}</Text>
          </View>
        </View>

        {/* Tone */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Tone</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {TONES.map((t) => (
              <Pressable key={t.id} onPress={() => { Haptics.selectionAsync(); setTone(t); }} style={[s.toneChip, tone.id === t.id && s.toneChipOn]}>
                <Text style={s.toneEmoji}>{t.emoji}</Text>
                <Text style={[s.toneText, tone.id === t.id && { color: ACCENT }]}>{t.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Emoji Style */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Emoji Style</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {EMOJI_STYLES.map((e) => (
              <Pressable key={e.id} onPress={() => { Haptics.selectionAsync(); setEmojiStyle(e); }} style={[s.emojiChip, emojiStyle.id === e.id && s.emojiChipOn]}>
                <Text style={[s.emojiChipText, emojiStyle.id === e.id && { color: ACCENT }]}>{e.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Form Fields */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Your Details</Text>
          <View style={s.fields}>
            <Field label="Your Name" value={name} onChange={setName} placeholder="e.g. Aqeel" />
            <Field label="Role / Profession" value={role} onChange={setRole} placeholder="e.g. Software Developer, Photographer" />
            <Field label="Company / Brand" value={company} onChange={setCompany} placeholder="e.g. Freelancer, Google" />
            <Field label="Location" value={location} onChange={setLocation} placeholder="e.g. Dubai, UAE" />
            <Field label="Interest / Niche #1" value={interest1} onChange={setInterest1} placeholder="e.g. AI, Fitness, Photography" />
            <Field label="Interest / Niche #2" value={interest2} onChange={setInterest2} placeholder="e.g. Travel, Music, Design" />
            <Field label="Extra info (optional)" value={extraInfo} onChange={setExtraInfo} placeholder="Achievements, links, CTA…" multiline />
          </View>
        </View>

        {/* Generate Button */}
        <Pressable onPress={generateBios} disabled={loading} style={[s.generateBtn, loading && { opacity: 0.7 }]}>
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <MaterialCommunityIcons name="robot-outline" size={20} color={Colors.white} />
              <Text style={s.generateBtnText}>Generate {hasAiKey ? "with AI" : "Bio"}</Text>
            </>
          )}
        </Pressable>
        {!hasAiKey && (
          <Text style={s.offlineNote}>No AI key — using offline templates. Add key in Settings for AI-crafted bios.</Text>
        )}

        {/* Results */}
        {bios.length > 0 && (
          <View style={s.resultsSection}>
            <Text style={s.resultsTitle}>{bios.length} Bios Generated ✨</Text>
            {bios.map((bio, idx) => (
              <View key={idx} style={[s.bioCard, { borderLeftColor: platform.color }]}>
                <View style={s.bioCardHeader}>
                  <View style={[s.bioNum, { backgroundColor: platform.bg }]}>
                    <Text style={[s.bioNumText, { color: platform.color }]}>#{idx + 1}</Text>
                  </View>
                  <Text style={[s.bioCharCount, { color: bio.length > platform.charLimit ? Colors.error : Colors.textMuted }]}>
                    {bio.length}/{platform.charLimit} chars
                  </Text>
                </View>
                <Text style={s.bioText}>{bio}</Text>
                <Pressable onPress={() => copyBio(bio, idx)} style={[s.copyBtn, copiedIdx === idx && { backgroundColor: "#059669" }]}>
                  <Ionicons name={copiedIdx === idx ? "checkmark" : "copy-outline"} size={15} color={Colors.white} />
                  <Text style={s.copyBtnText}>{copiedIdx === idx ? "Copied!" : "Copy Bio"}</Text>
                </Pressable>
              </View>
            ))}
            <Pressable onPress={generateBios} style={s.regenerateBtn}>
              <Ionicons name="refresh" size={16} color={ACCENT} />
              <Text style={s.regenerateBtnText}>Generate New Bios</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Field({ label, value, onChange, placeholder, multiline }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; multiline?: boolean }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={fs.label}>{label}</Text>
      <TextInput
        style={[fs.input, multiline && { height: 72, textAlignVertical: "top" }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline={multiline}
      />
    </View>
  );
}
const fs = StyleSheet.create({
  label: { fontFamily: "Poppins_500Medium", fontSize: 12, color: Colors.textSecondary },
  input: { backgroundColor: Colors.white, borderRadius: 12, padding: 12, fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.cardBorder },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  section: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  sectionLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: Colors.text },
  platformChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.separator, borderWidth: 1.5, borderColor: Colors.cardBorder },
  platformChipText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: Colors.textSecondary },
  platformTip: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: 12 },
  platformTipText: { fontFamily: "Poppins_400Regular", fontSize: 12, flex: 1, lineHeight: 18 },
  toneChip: { alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.separator, borderWidth: 1.5, borderColor: Colors.cardBorder, gap: 2 },
  toneChipOn: { backgroundColor: ACCENT_LIGHT, borderColor: ACCENT },
  toneEmoji: { fontSize: 18 },
  toneText: { fontFamily: "Poppins_500Medium", fontSize: 10, color: Colors.textSecondary },
  emojiChip: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 20, backgroundColor: Colors.separator, borderWidth: 1.5, borderColor: Colors.cardBorder },
  emojiChipOn: { backgroundColor: ACCENT_LIGHT, borderColor: ACCENT },
  emojiChipText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: Colors.textSecondary },
  fields: { gap: 10 },
  generateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: ACCENT, borderRadius: 16, paddingVertical: 16, marginHorizontal: 16, marginTop: 8 },
  generateBtnText: { fontFamily: "Poppins_700Bold", fontSize: 15, color: Colors.white },
  offlineNote: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textMuted, textAlign: "center", marginTop: 6, marginHorizontal: 16 },
  resultsSection: { marginHorizontal: 16, marginTop: 16, gap: 12 },
  resultsTitle: { fontFamily: "Poppins_700Bold", fontSize: 16, color: Colors.text },
  bioCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: Colors.cardBorder, borderLeftWidth: 4 },
  bioCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bioNum: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  bioNumText: { fontFamily: "Poppins_700Bold", fontSize: 11 },
  bioCharCount: { fontFamily: "Poppins_400Regular", fontSize: 11 },
  bioText: { fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.text, lineHeight: 22 },
  copyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 10 },
  copyBtnText: { fontFamily: "Poppins_700Bold", fontSize: 13, color: Colors.white },
  regenerateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 14, borderWidth: 1.5, borderColor: ACCENT, backgroundColor: ACCENT_LIGHT },
  regenerateBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: ACCENT },
});
