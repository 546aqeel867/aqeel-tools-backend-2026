import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import ToolHeader from "@/components/ToolHeader";

const CHARS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?",
};

function generatePassword(length: number, opts: Record<string, boolean>): string {
  let pool = "";
  if (opts.uppercase) pool += CHARS.uppercase;
  if (opts.lowercase) pool += CHARS.lowercase;
  if (opts.numbers) pool += CHARS.numbers;
  if (opts.symbols) pool += CHARS.symbols;
  if (!pool) return "";
  return Array.from({ length }, () => pool[Math.floor(Math.random() * pool.length)]).join("");
}

function getStrength(pwd: string): { label: string; color: string; score: number } {
  if (!pwd) return { label: "None", color: Colors.textMuted, score: 0 };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (pwd.length >= 16) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 2) return { label: "Weak", color: Colors.error, score };
  if (score <= 4) return { label: "Fair", color: Colors.warning, score };
  if (score <= 5) return { label: "Good", color: "#84CC16", score };
  return { label: "Strong", color: Colors.success, score };
}

const OPT_META = {
  uppercase: { label: "Uppercase", desc: "A–Z", icon: "alphabetical-variant" },
  lowercase: { label: "Lowercase", desc: "a–z", icon: "alphabetical-lowercase" },
  numbers: { label: "Numbers", desc: "0–9", icon: "numeric" },
  symbols: { label: "Symbols", desc: "!@#$%", icon: "symbol" },
};

export default function PasswordGenerator() {
  const insets = useSafeAreaInsets();
  const [length, setLength] = useState(16);
  const [opts, setOpts] = useState({ uppercase: true, lowercase: true, numbers: true, symbols: false });
  const [password, setPassword] = useState(() =>
    generatePassword(16, { uppercase: true, lowercase: true, numbers: true, symbols: false })
  );
  const [copied, setCopied] = useState(false);

  const generate = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPassword(generatePassword(length, opts));
    setCopied(false);
  }, [length, opts]);

  const copy = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copied!", "Password copied to clipboard.");
    setCopied(true);
  };

  const toggleOpt = (key: keyof typeof opts) => {
    Haptics.selectionAsync();
    setOpts((p) => ({ ...p, [key]: !p[key] }));
  };

  const strength = getStrength(password);
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  return (
    <View style={styles.container}>
      <ToolHeader title="Password Generator" subtitle="Create secure, custom passwords" accentColor="#059669" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>

        <View style={styles.pwdCard}>
          <View style={styles.pwdHeader}>
            <Ionicons name="shield-checkmark-outline" size={20} color={Colors.success} />
            <Text style={styles.pwdHeaderText}>Generated Password</Text>
          </View>
          <Text style={styles.pwdText} selectable numberOfLines={3}>{password || "Configure options below"}</Text>

          <View style={styles.strengthRow}>
            <View style={styles.strengthBars}>
              {[1, 2, 3, 4].map((i) => (
                <View
                  key={i}
                  style={[styles.bar, { backgroundColor: i <= Math.ceil(strength.score / 2) ? strength.color : Colors.separator }]}
                />
              ))}
            </View>
            <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
          </View>

          <View style={styles.actionRow}>
            <Pressable onPress={copy} style={[styles.actionBtn, styles.copyBtn]}>
              <Ionicons name={copied ? "checkmark" : "copy-outline"} size={17} color={Colors.primary} />
              <Text style={[styles.actionBtnText, { color: Colors.primary }]}>{copied ? "Copied!" : "Copy"}</Text>
            </Pressable>
            <Pressable onPress={generate} style={[styles.actionBtn, styles.genBtn]}>
              <Ionicons name="refresh" size={17} color={Colors.white} />
              <Text style={[styles.actionBtnText, { color: Colors.white }]}>Regenerate</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Length: <Text style={styles.labelVal}>{length} characters</Text></Text>
          <View style={styles.lengthRow}>
            <Pressable onPress={() => setLength((l) => Math.max(4, l - 1))} style={styles.counterBtn}>
              <Ionicons name="remove" size={18} color={Colors.text} />
            </Pressable>
            <View style={styles.lengthBarWrap}>
              <View style={[styles.lengthBarFill, { width: `${((length - 4) / 60) * 100}%` }]} />
            </View>
            <Pressable onPress={() => setLength((l) => Math.min(64, l + 1))} style={styles.counterBtn}>
              <Ionicons name="add" size={18} color={Colors.text} />
            </Pressable>
          </View>
          <View style={styles.presetRow}>
            {[8, 12, 16, 24, 32].map((l) => (
              <Pressable
                key={l}
                onPress={() => { Haptics.selectionAsync(); setLength(l); }}
                style={[styles.presetChip, length === l && styles.presetChipActive]}
              >
                <Text style={[styles.presetChipText, length === l && styles.presetChipTextActive]}>{l}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Character Types</Text>
          {(Object.keys(opts) as Array<keyof typeof opts>).map((key) => {
            const meta = OPT_META[key];
            return (
              <Pressable key={key} onPress={() => toggleOpt(key)} style={styles.optRow}>
                <View style={[styles.optIconBox, { backgroundColor: opts[key] ? Colors.successLight : Colors.separator }]}>
                  <MaterialCommunityIcons
                    name={meta.icon as any}
                    size={18}
                    color={opts[key] ? Colors.success : Colors.textSecondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optLabel}>{meta.label}</Text>
                  <Text style={styles.optDesc}>{meta.desc}</Text>
                </View>
                <View style={[styles.toggle, opts[key] && styles.toggleOn]}>
                  <View style={[styles.toggleThumb, opts[key] && styles.toggleThumbOn]} />
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={generate}
          style={({ pressed }) => [styles.bigBtn, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
        >
          <Ionicons name="shield-checkmark-outline" size={20} color={Colors.white} />
          <Text style={styles.bigBtnText}>Generate New Password</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const CARD_SHADOW = {
  shadowColor: Colors.shadow,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 14 },
  pwdCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...CARD_SHADOW,
  },
  pwdHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pwdHeaderText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: Colors.text,
  },
  pwdText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    color: Colors.text,
    letterSpacing: 1.5,
    lineHeight: 28,
    minHeight: 56,
    backgroundColor: Colors.separator,
    borderRadius: 10,
    padding: 12,
  },
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  strengthBars: { flex: 1, flexDirection: "row", gap: 4 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    width: 48,
    textAlign: "right",
  },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 7,
  },
  copyBtn: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  genBtn: { backgroundColor: Colors.success },
  actionBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...CARD_SHADOW,
  },
  label: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  labelVal: {
    color: Colors.text,
    fontFamily: "Poppins_600SemiBold",
  },
  lengthRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  counterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.separator,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  lengthBarWrap: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.separator,
    borderRadius: 3,
    overflow: "hidden",
  },
  lengthBarFill: { height: "100%", backgroundColor: Colors.success, borderRadius: 3 },
  presetRow: { flexDirection: "row", gap: 8 },
  presetChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.separator,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  presetChipActive: { backgroundColor: Colors.success, borderColor: Colors.success },
  presetChipText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  presetChipTextActive: { color: Colors.white },
  optRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
  optIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  optLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: Colors.text,
  },
  optDesc: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.cardBorder,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleOn: { backgroundColor: Colors.success },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbOn: { alignSelf: "flex-end" },
  bigBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bigBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: Colors.white,
  },
});
