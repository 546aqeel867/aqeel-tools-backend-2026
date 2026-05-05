import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView, Platform,
  Alert, KeyboardAvoidingView, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { Colors } from "@/constants/colors";
import ToolHeader from "@/components/ToolHeader";
import { useApp, AiProvider } from "@/contexts/AppContext";
import { validateAiKey, cloudStatus } from "@/lib/db-client";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { apiKeys, updateApiKeys, isLoggedIn, email, isCloudSynced, cloudSyncAll, cloudFetchAll } = useApp();
  const [provider, setProvider] = useState<AiProvider>(apiKeys.aiProvider);
  const [openrouter, setOpenrouter] = useState(apiKeys.openrouterKey);
  const [hf, setHf] = useState(apiKeys.huggingfaceKey);
  const [eleven, setEleven] = useState(apiKeys.elevenlabsKey);
  const [voiceId, setVoiceId] = useState(apiKeys.elevenlabsVoiceId);
  const [groq, setGroq] = useState(apiKeys.groqKey || "");
  const [showOR, setShowOR] = useState(false);
  const [showHF, setShowHF] = useState(false);
  const [showEL, setShowEL] = useState(false);
  const [showGroq, setShowGroq] = useState(false);
  const [validating, setValidating] = useState<"openrouter" | "huggingface" | null>(null);
  const [validStatus, setValidStatus] = useState<Record<string, "valid" | "invalid" | null>>({});
  const [syncing, setSyncing] = useState(false);
  const [appwriteConfigured, setAppwriteConfigured] = useState(false);
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  useEffect(() => {
    cloudStatus().then((s) => setAppwriteConfigured(s.configured));
  }, []);

  const dirty =
    provider !== apiKeys.aiProvider ||
    openrouter !== apiKeys.openrouterKey ||
    hf !== apiKeys.huggingfaceKey ||
    eleven !== apiKeys.elevenlabsKey ||
    voiceId !== apiKeys.elevenlabsVoiceId ||
    groq !== (apiKeys.groqKey || "");

  const onSave = async () => {
    await updateApiKeys({
      aiProvider: provider,
      openrouterKey: openrouter.trim(),
      huggingfaceKey: hf.trim(),
      elevenlabsKey: eleven.trim(),
      elevenlabsVoiceId: voiceId.trim() || "21m00Tcm4TlvDq8ikWAM",
      groqKey: groq.trim(),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Saved", "Your API keys have been saved securely.");
  };

  const onValidate = async (prov: "openrouter" | "huggingface") => {
    const key = prov === "openrouter" ? openrouter.trim() : hf.trim();
    if (!key) {
      Alert.alert("No key", "Enter your API key first, then tap Validate.");
      return;
    }
    setValidating(prov);
    setValidStatus((prev) => ({ ...prev, [prov]: null }));
    try {
      const result = await validateAiKey(prov, key);
      setValidStatus((prev) => ({ ...prev, [prov]: result.valid ? "valid" : "invalid" }));
      Haptics.notificationAsync(
        result.valid ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
      );
      if (!result.valid) Alert.alert("Invalid key", result.error || "The API key was rejected.");
    } catch {
      setValidStatus((prev) => ({ ...prev, [prov]: "invalid" }));
    } finally {
      setValidating(null);
    }
  };

  const onClear = (which: "openrouter" | "hf" | "eleven") => {
    Alert.alert("Remove key?", "This will delete the saved key from this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive", onPress: () => {
          if (which === "openrouter") { setOpenrouter(""); setValidStatus((p) => ({ ...p, openrouter: null })); }
          if (which === "hf") { setHf(""); setValidStatus((p) => ({ ...p, huggingface: null })); }
          if (which === "eleven") setEleven("");
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  };

  const onCloudSync = async () => {
    if (!isLoggedIn) {
      Alert.alert("Sign in required", "Please create an account or log in to use cloud sync.");
      return;
    }
    setSyncing(true);
    try {
      await cloudSyncAll();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Synced!", "Your data has been backed up to the cloud.");
    } catch {
      Alert.alert("Sync failed", "Could not connect to cloud. Check your internet connection.");
    } finally {
      setSyncing(false);
    }
  };

  const onCloudRestore = async () => {
    if (!isLoggedIn) {
      Alert.alert("Sign in required", "Please create an account or log in to restore from cloud.");
      return;
    }
    Alert.alert(
      "Restore from cloud?",
      "This will overwrite your current notes and chat sessions with the cloud version.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore", onPress: async () => {
            setSyncing(true);
            try {
              await cloudFetchAll();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Restored!", "Your data has been restored from the cloud.");
            } catch {
              Alert.alert("Restore failed", "Could not fetch data from the cloud.");
            } finally {
              setSyncing(false);
            }
          },
        },
      ],
    );
  };

  const openLink = async (url: string) => {
    try { await WebBrowser.openBrowserAsync(url); } catch {}
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <ToolHeader title="API Keys & Settings" subtitle="Securely manage your AI keys" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 80 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Cloud Sync Banner */}
          <View style={[styles.cloudCard, { borderColor: appwriteConfigured ? Colors.success : Colors.cardBorder }]}>
            <View style={[styles.cloudIconWrap, { backgroundColor: appwriteConfigured ? Colors.successLight : Colors.separator }]}>
              <Ionicons name={appwriteConfigured ? "cloud-done" : "cloud-outline"} size={20} color={appwriteConfigured ? Colors.success : Colors.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cloudTitle}>
                {appwriteConfigured ? "Cloud Sync Active" : "Cloud Sync"}
              </Text>
              <Text style={styles.cloudSubtitle}>
                {appwriteConfigured
                  ? `Appwrite database connected${isCloudSynced ? " · Last synced ✓" : ""}`
                  : "Add APPWRITE_PROJECT_ID & APPWRITE_API_KEY in Replit Secrets to enable cloud backup."}
              </Text>
            </View>
            {appwriteConfigured && (
              <View style={{ gap: 6 }}>
                <Pressable onPress={onCloudSync} disabled={syncing} style={styles.cloudBtn}>
                  {syncing
                    ? <ActivityIndicator size="small" color={Colors.white} />
                    : <Ionicons name="cloud-upload-outline" size={14} color={Colors.white} />}
                  <Text style={styles.cloudBtnText}>Sync</Text>
                </Pressable>
                <Pressable onPress={onCloudRestore} disabled={syncing} style={[styles.cloudBtn, { backgroundColor: Colors.separator }]}>
                  <Ionicons name="cloud-download-outline" size={14} color={Colors.text} />
                  <Text style={[styles.cloudBtnText, { color: Colors.text }]}>Restore</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Info banner */}
          <View style={styles.banner}>
            <View style={styles.bannerIconWrap}>
              <Ionicons name="key" size={20} color={Colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Bring your own AI key</Text>
              <Text style={styles.bannerText}>
                AI features only work after you add an API key here. Keys are stored
                only on this device and sent directly with each AI request.
              </Text>
            </View>
          </View>

          {/* Provider switch */}
          <Text style={styles.sectionLabel}>AI Provider</Text>
          <View style={styles.providerRow}>
            <Pressable
              onPress={() => { setProvider("openrouter"); Haptics.selectionAsync(); }}
              style={[styles.providerCard, provider === "openrouter" && styles.providerCardActive]}
            >
              <MaterialCommunityIcons name="lightning-bolt" size={20} color={provider === "openrouter" ? Colors.white : Colors.primary} />
              <Text style={[styles.providerName, provider === "openrouter" && { color: Colors.white }]}>OpenRouter</Text>
              <Text style={[styles.providerHint, provider === "openrouter" && { color: "rgba(255,255,255,0.85)" }]}>Free models supported</Text>
            </Pressable>
            <Pressable
              onPress={() => { setProvider("huggingface"); Haptics.selectionAsync(); }}
              style={[styles.providerCard, provider === "huggingface" && styles.providerCardActive]}
            >
              <MaterialCommunityIcons name="hexagon-multiple" size={20} color={provider === "huggingface" ? Colors.white : Colors.warning} />
              <Text style={[styles.providerName, provider === "huggingface" && { color: Colors.white }]}>Hugging Face</Text>
              <Text style={[styles.providerHint, provider === "huggingface" && { color: "rgba(255,255,255,0.85)" }]}>Inference Router</Text>
            </Pressable>
          </View>

          {/* OpenRouter */}
          <KeyCard
            label="OpenRouter API Key"
            placeholder="sk-or-v1-..."
            value={openrouter}
            onChangeText={(v) => { setOpenrouter(v); setValidStatus((p) => ({ ...p, openrouter: null })); }}
            secureTextEntry={!showOR}
            onToggleVisibility={() => setShowOR(!showOR)}
            onClear={() => onClear("openrouter")}
            helpText="Optional — adds your own key for priority access and higher rate limits. Without it, free shared models are used automatically."
            helpLink="https://openrouter.ai/keys"
            icon="lightning-bolt"
            iconColor={Colors.primary}
            validStatus={validStatus["openrouter"] ?? null}
            validating={validating === "openrouter"}
            onValidate={() => onValidate("openrouter")}
          />

          {/* Hugging Face */}
          <KeyCard
            label="Hugging Face Token"
            placeholder="hf_..."
            value={hf}
            onChangeText={(v) => { setHf(v); setValidStatus((p) => ({ ...p, huggingface: null })); }}
            secureTextEntry={!showHF}
            onToggleVisibility={() => setShowHF(!showHF)}
            onClear={() => onClear("hf")}
            helpText="Use any Hugging Face access token with Inference permission."
            helpLink="https://huggingface.co/settings/tokens"
            icon="hexagon-multiple"
            iconColor={Colors.warning}
            validStatus={validStatus["huggingface"] ?? null}
            validating={validating === "huggingface"}
            onValidate={() => onValidate("huggingface")}
          />

          {/* ElevenLabs */}
          <Text style={styles.sectionLabel}>Voice (ElevenLabs)</Text>
          <KeyCard
            label="ElevenLabs API Key"
            placeholder="sk_..."
            value={eleven}
            onChangeText={setEleven}
            secureTextEntry={!showEL}
            onToggleVisibility={() => setShowEL(!showEL)}
            onClear={() => onClear("eleven")}
            helpText="Powers high-quality AI voice for chat. Free tier works."
            helpLink="https://elevenlabs.io/app/settings/api-keys"
            icon="microphone"
            iconColor={Colors.secondary}
            validStatus={null}
            validating={false}
          />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Voice ID</Text>
            <TextInput
              style={styles.input}
              value={voiceId}
              onChangeText={setVoiceId}
              placeholder="21m00Tcm4TlvDq8ikWAM (Rachel)"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable onPress={() => openLink("https://elevenlabs.io/app/voice-library")} style={styles.helpRow}>
              <Ionicons name="link-outline" size={12} color={Colors.primary} />
              <Text style={styles.helpLink}>Browse voice library</Text>
            </Pressable>
          </View>

          {/* Groq STT */}
          <Text style={styles.sectionLabel}>Voice STT — Groq (Optional)</Text>
          <KeyCard
            label="Groq API Key"
            placeholder="gsk_..."
            value={groq}
            onChangeText={setGroq}
            secureTextEntry={!showGroq}
            onToggleVisibility={() => setShowGroq(!showGroq)}
            onClear={() => setGroq("")}
            helpText="Free Groq Whisper key powers real voice input in Zara AI Call Assistant."
            helpLink="https://console.groq.com/keys"
            icon="waveform"
            iconColor="#10B981"
            validStatus={null}
            validating={false}
          />

          <Pressable
            onPress={onSave}
            disabled={!dirty}
            style={({ pressed }) => [
              styles.saveBtn,
              { opacity: !dirty ? 0.5 : pressed ? 0.85 : 1 },
            ]}
          >
            <Ionicons name="save-outline" size={18} color={Colors.white} />
            <Text style={styles.saveText}>{dirty ? "Save Settings" : "All changes saved"}</Text>
          </Pressable>

          <View style={styles.privacyCard}>
            <Ionicons name="lock-closed" size={16} color={Colors.success} />
            <Text style={styles.privacyText}>
              Your API keys are stored locally on your device and never shared with anyone other than the AI provider you choose.
              {appwriteConfigured ? " Cloud sync encrypts your data before storing it in Appwrite." : ""}
            </Text>
          </View>

          {/* Appwrite setup guide */}
          {!appwriteConfigured && (
            <View style={styles.setupCard}>
              <Text style={styles.setupTitle}>Enable Cloud Backup (Appwrite)</Text>
              <Text style={styles.setupText}>
                1. Create a free account at cloud.appwrite.io{"\n"}
                2. Create a project and copy the Project ID{"\n"}
                3. Generate an API Key with Database permissions{"\n"}
                4. Add these to Replit Secrets:{"\n"}
                {"   "}• APPWRITE_PROJECT_ID{"\n"}
                {"   "}• APPWRITE_API_KEY{"\n"}
                5. Restart the backend and tap Sync
              </Text>
              <Pressable onPress={() => openLink("https://cloud.appwrite.io")} style={styles.helpRow}>
                <Ionicons name="open-outline" size={12} color={Colors.primary} />
                <Text style={styles.helpLink}>Open Appwrite Console</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function KeyCard({
  label, placeholder, value, onChangeText, secureTextEntry,
  onToggleVisibility, onClear, helpText, helpLink, icon, iconColor,
  validStatus, validating, onValidate,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry: boolean;
  onToggleVisibility: () => void;
  onClear: () => void;
  helpText: string;
  helpLink: string;
  icon: string;
  iconColor: string;
  validStatus: "valid" | "invalid" | null;
  validating: boolean;
  onValidate?: () => void;
}) {
  const openLink = async (url: string) => {
    try { await WebBrowser.openBrowserAsync(url); } catch {}
  };

  const statusColor = validStatus === "valid" ? Colors.success : validStatus === "invalid" ? Colors.error : null;
  const statusIcon = validStatus === "valid" ? "checkmark-circle" : validStatus === "invalid" ? "close-circle" : null;

  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <View style={[styles.fieldIcon, { backgroundColor: iconColor + "20" }]}>
          <MaterialCommunityIcons name={icon as any} size={16} color={iconColor} />
        </View>
        <Text style={styles.fieldLabel}>{label}</Text>
        {value.length > 0 && !validStatus && (
          <View style={styles.savedDot}>
            <View style={styles.savedDotInner} />
            <Text style={styles.savedText}>Saved</Text>
          </View>
        )}
        {statusIcon && (
          <Ionicons name={statusIcon as any} size={18} color={statusColor!} />
        )}
      </View>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={secureTextEntry}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable onPress={onToggleVisibility} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name={secureTextEntry ? "eye-outline" : "eye-off-outline"} size={18} color={Colors.textSecondary} />
        </Pressable>
        {value.length > 0 && (
          <Pressable onPress={onClear} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={Colors.error} />
          </Pressable>
        )}
      </View>
      {onValidate && (
        <Pressable
          onPress={onValidate}
          disabled={validating || !value.trim()}
          style={[styles.validateBtn, { opacity: !value.trim() ? 0.4 : 1 }]}
        >
          {validating
            ? <ActivityIndicator size="small" color={Colors.primary} />
            : <Ionicons name="shield-checkmark-outline" size={14} color={Colors.primary} />}
          <Text style={styles.validateText}>{validating ? "Testing..." : "Validate Key"}</Text>
        </Pressable>
      )}
      <Text style={styles.helpText}>{helpText}</Text>
      <Pressable onPress={() => openLink(helpLink)} style={styles.helpRow}>
        <Ionicons name="open-outline" size={12} color={Colors.primary} />
        <Text style={styles.helpLink}>Get a free key</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, gap: 14 },
  cloudCard: {
    flexDirection: "row", gap: 12, padding: 14, borderRadius: 14,
    backgroundColor: Colors.white, borderWidth: 1.5, alignItems: "center",
  },
  cloudIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
  },
  cloudTitle: { fontFamily: "Poppins_700Bold", fontSize: 13, color: Colors.text },
  cloudSubtitle: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textSecondary, lineHeight: 16, marginTop: 2 },
  cloudBtn: {
    flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10,
    paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.primary,
  },
  cloudBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 11, color: Colors.white },
  banner: {
    flexDirection: "row", gap: 12, padding: 14, borderRadius: 14,
    backgroundColor: Colors.primary, alignItems: "flex-start",
  },
  bannerIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center",
  },
  bannerTitle: { fontFamily: "Poppins_700Bold", fontSize: 15, color: Colors.white },
  bannerText: { fontFamily: "Poppins_400Regular", fontSize: 12, color: "rgba(255,255,255,0.9)", lineHeight: 18, marginTop: 2 },
  sectionLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: Colors.textSecondary, marginTop: 4, marginBottom: -4, textTransform: "uppercase", letterSpacing: 0.5 },
  providerRow: { flexDirection: "row", gap: 10 },
  providerCard: {
    flex: 1, padding: 14, borderRadius: 14, backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.cardBorder, alignItems: "flex-start", gap: 4,
  },
  providerCardActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  providerName: { fontFamily: "Poppins_700Bold", fontSize: 14, color: Colors.text, marginTop: 4 },
  providerHint: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textSecondary },
  field: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.cardBorder, gap: 8 },
  fieldHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  fieldIcon: { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  fieldLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: Colors.text, flex: 1 },
  savedDot: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: Colors.successLight },
  savedDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  savedText: { fontFamily: "Poppins_500Medium", fontSize: 10, color: Colors.success },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  input: {
    backgroundColor: Colors.separator, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: "Poppins_400Regular", fontSize: 13, color: Colors.text,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  iconBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center", borderRadius: 10, backgroundColor: Colors.separator },
  validateBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.primary + "10",
  },
  validateText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: Colors.primary },
  helpText: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },
  helpRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  helpLink: { fontFamily: "Poppins_500Medium", fontSize: 11, color: Colors.primary },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
  saveText: { fontFamily: "Poppins_700Bold", fontSize: 14, color: Colors.white },
  privacyCard: { flexDirection: "row", gap: 10, padding: 12, borderRadius: 12, backgroundColor: Colors.successLight, alignItems: "flex-start" },
  privacyText: { flex: 1, fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.text, lineHeight: 16 },
  setupCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.cardBorder, gap: 10 },
  setupTitle: { fontFamily: "Poppins_700Bold", fontSize: 13, color: Colors.text },
  setupText: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
});
