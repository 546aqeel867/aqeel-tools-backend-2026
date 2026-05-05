import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Pressable,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import QRCode from "react-native-qrcode-svg";
import { CameraView, useCameraPermissions } from "expo-camera";
import ViewShot, { captureRef } from "react-native-view-shot";
import { Colors } from "@/constants/colors";
import ToolHeader from "@/components/ToolHeader";

type Tab = "generate" | "scan";

const PRESETS = [
  { label: "URL", placeholder: "https://example.com", icon: "globe-outline" as const },
  { label: "Email", placeholder: "mailto:you@example.com", icon: "mail-outline" as const },
  { label: "Phone", placeholder: "tel:+1234567890", icon: "call-outline" as const },
  { label: "WiFi", placeholder: "WIFI:T:WPA;S:NetworkName;P:Password;;", icon: "wifi-outline" as const },
  { label: "Text", placeholder: "Any text...", icon: "text-outline" as const },
];

const QR_COLORS = [
  { fg: "#1E293B", bg: "#FFFFFF", label: "Dark" },
  { fg: "#2563EB", bg: "#EBF2FF", label: "Blue" },
  { fg: "#059669", bg: "#ECFDF5", label: "Green" },
  { fg: "#7C3AED", bg: "#F3EEFF", label: "Purple" },
  { fg: "#DB2777", bg: "#FDF2F8", label: "Pink" },
];

function QRGenerator() {
  const [text, setText] = useState("");
  const [size, setSize] = useState(220);
  const [presetIdx, setPresetIdx] = useState(0);
  const [colorIdx, setColorIdx] = useState(0);
  const viewShotRef = useRef<ViewShot>(null);

  const qrColor = QR_COLORS[colorIdx];
  const SIZES = [160, 220, 280];

  const handleShare = useCallback(async () => {
    if (!text.trim()) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (Platform.OS === "web") {
        Alert.alert("Share", "Image sharing is available on the mobile app. On web, right-click the QR code to save it.");
        return;
      }
      if (!viewShotRef.current) return;
      const uri = await captureRef(viewShotRef, { format: "png", quality: 1, result: "tmpfile" });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share QR Code" });
      } else {
        Alert.alert("Saved", "QR code saved successfully!");
      }
    } catch (err) {
      Alert.alert("Error", "Could not share QR code. Please try again.");
    }
  }, [text]);

  const handleDownload = useCallback(async () => {
    if (!text.trim()) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (Platform.OS === "web") {
        Alert.alert("Download", "On web, right-click the QR code and select 'Save image' to download it.");
        return;
      }
      if (!viewShotRef.current) return;
      const uri = await captureRef(viewShotRef, { format: "png", quality: 1, result: "tmpfile" });
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Please allow media library access to save the QR code.");
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved!", "QR code saved to your photo library.");
    } catch (err) {
      Alert.alert("Error", "Could not save QR code. Please try again.");
    }
  }, [text]);

  return (
    <ScrollView contentContainerStyle={genStyles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={genStyles.card}>
        <Text style={genStyles.label}>Content Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={genStyles.presetRow}>
            {PRESETS.map((p, i) => (
              <Pressable
                key={p.label}
                onPress={() => { Haptics.selectionAsync(); setPresetIdx(i); setText(""); }}
                style={[genStyles.presetChip, presetIdx === i && genStyles.presetChipActive]}
              >
                <Ionicons name={p.icon} size={14} color={presetIdx === i ? Colors.white : Colors.textSecondary} />
                <Text style={[genStyles.presetChipText, presetIdx === i && { color: Colors.white }]}>{p.label}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        <Text style={genStyles.label}>Content</Text>
        <TextInput
          style={genStyles.input}
          value={text}
          onChangeText={setText}
          placeholder={PRESETS[presetIdx].placeholder}
          placeholderTextColor={Colors.textMuted}
          multiline
          maxLength={500}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={genStyles.charCount}>{text.length}/500</Text>
      </View>

      <View style={genStyles.card}>
        <Text style={genStyles.label}>Color Theme</Text>
        <View style={genStyles.colorRow}>
          {QR_COLORS.map((c, i) => (
            <Pressable
              key={c.label}
              onPress={() => { Haptics.selectionAsync(); setColorIdx(i); }}
              style={[genStyles.colorDot, { backgroundColor: c.fg }, i === colorIdx && genStyles.colorDotActive]}
            />
          ))}
        </View>
        <Text style={genStyles.label}>Size</Text>
        <View style={genStyles.sizeRow}>
          {SIZES.map((s) => (
            <Pressable
              key={s}
              onPress={() => { Haptics.selectionAsync(); setSize(s); }}
              style={[genStyles.sizeChip, size === s && genStyles.sizeChipActive]}
            >
              <Text style={[genStyles.sizeChipText, size === s && { color: Colors.white }]}>{s}px</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {text.trim() ? (
        <View style={[genStyles.qrContainer, { backgroundColor: qrColor.bg }]}>
          <ViewShot ref={viewShotRef} options={{ format: "png", quality: 1 }}>
            <View style={[genStyles.qrWrapper, { backgroundColor: qrColor.bg, padding: 20 }]}>
              <QRCode
                value={text || " "}
                size={size}
                color={qrColor.fg}
                backgroundColor={qrColor.bg}
              />
            </View>
          </ViewShot>
          <Text style={genStyles.qrNote}>Your QR code is ready</Text>
          <View style={genStyles.actionsRow}>
            <Pressable onPress={handleShare} style={genStyles.actionBtn}>
              <Ionicons name="share-outline" size={18} color={Colors.white} />
              <Text style={genStyles.actionBtnText}>Share</Text>
            </Pressable>
            <Pressable onPress={handleDownload} style={[genStyles.actionBtn, { backgroundColor: Colors.success }]}>
              <Ionicons name="download-outline" size={18} color={Colors.white} />
              <Text style={genStyles.actionBtnText}>Download</Text>
            </Pressable>
            <Pressable
              onPress={() => { setText(""); Haptics.selectionAsync(); }}
              style={[genStyles.actionBtn, { backgroundColor: Colors.separator, borderWidth: 1, borderColor: Colors.cardBorder }]}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.error} />
              <Text style={[genStyles.actionBtnText, { color: Colors.error }]}>Clear</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={genStyles.emptyQR}>
          <Ionicons name="qr-code-outline" size={64} color={Colors.textMuted} />
          <Text style={genStyles.emptyQRText}>Enter content above to generate your QR code</Text>
        </View>
      )}
    </ScrollView>
  );
}

function QRScanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  const handleBarcodeScanned = useCallback(({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setScanResult(data);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [scanned]);

  const handleReset = () => {
    setScanned(false);
    setScanResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  if (!permission) {
    return <View style={scanStyles.center}><Text style={scanStyles.permText}>Loading camera...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={scanStyles.center}>
        <Ionicons name="camera-outline" size={56} color={Colors.textMuted} />
        <Text style={scanStyles.permTitle}>Camera Access Required</Text>
        <Text style={scanStyles.permText}>Allow camera access to scan QR codes</Text>
        <Pressable onPress={requestPermission} style={scanStyles.permBtn}>
          <Text style={scanStyles.permBtnText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={scanStyles.container}>
      {!scanResult ? (
        <View style={scanStyles.cameraWrapper}>
          <CameraView
            style={scanStyles.camera}
            barcodeScannerSettings={{ barcodeTypes: ["qr", "pdf417", "code128", "code39", "ean13", "ean8"] }}
            onBarcodeScanned={handleBarcodeScanned}
          >
            <View style={scanStyles.overlay}>
              <Text style={scanStyles.overlayHint}>Point at a QR code</Text>
              <View style={scanStyles.frame}>
                <View style={[scanStyles.corner, scanStyles.cornerTL]} />
                <View style={[scanStyles.corner, scanStyles.cornerTR]} />
                <View style={[scanStyles.corner, scanStyles.cornerBL]} />
                <View style={[scanStyles.corner, scanStyles.cornerBR]} />
              </View>
            </View>
          </CameraView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={scanStyles.resultContent} showsVerticalScrollIndicator={false}>
          <View style={scanStyles.successIcon}>
            <Ionicons name="checkmark-circle" size={56} color={Colors.success} />
          </View>
          <Text style={scanStyles.resultTitle}>QR Code Scanned!</Text>
          <View style={scanStyles.resultCard}>
            <Text style={scanStyles.resultText} selectable>{scanResult}</Text>
          </View>
          <View style={scanStyles.resultActions}>
            <Pressable onPress={() => Alert.alert("Copied!", "Content copied to clipboard.")} style={scanStyles.resultBtn}>
              <Ionicons name="copy-outline" size={16} color={Colors.primary} />
              <Text style={scanStyles.resultBtnText}>Copy</Text>
            </Pressable>
            <Pressable onPress={handleReset} style={[scanStyles.resultBtn, { backgroundColor: Colors.primary }]}>
              <Ionicons name="scan-outline" size={16} color={Colors.white} />
              <Text style={[scanStyles.resultBtnText, { color: Colors.white }]}>Scan Again</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

export default function QRTool() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("generate");
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={styles.container}>
      <ToolHeader title="QR Code Tool" subtitle="Generate, download & scan" accentColor="#7C3AED" />
      <View style={styles.tabRow}>
        {([["generate", "Generate QR", "qr-code-outline"], ["scan", "Scan QR", "scan-outline"]] as const).map(([t, label, icon]) => (
          <Pressable
            key={t}
            onPress={() => { Haptics.selectionAsync(); setTab(t); }}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
          >
            <Ionicons name={icon} size={18} color={tab === t ? Colors.white : Colors.textSecondary} />
            <Text style={[styles.tabBtnText, tab === t && { color: Colors.white }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flex: 1, paddingBottom: bottomPad }}>
        {tab === "generate" ? <QRGenerator /> : <QRScanner />}
      </View>
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
  tabRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: Colors.separator,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 10,
    borderRadius: 9,
  },
  tabBtnActive: { backgroundColor: "#7C3AED" },
  tabBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: Colors.textSecondary,
  },
});

const genStyles = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...CARD_SHADOW,
  },
  label: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  presetRow: { flexDirection: "row", gap: 8 },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.separator,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  presetChipActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
  presetChipText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  input: {
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    color: Colors.text,
    minHeight: 70,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 10,
    padding: 12,
    backgroundColor: Colors.separator,
  },
  charCount: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: "right",
  },
  colorRow: { flexDirection: "row", gap: 12 },
  colorDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: "transparent" },
  colorDotActive: { borderColor: Colors.primary, transform: [{ scale: 1.18 }] },
  sizeRow: { flexDirection: "row", gap: 8 },
  sizeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.separator,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  sizeChipActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
  sizeChipText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  qrContainer: {
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...CARD_SHADOW,
  },
  qrWrapper: { borderRadius: 12, overflow: "hidden" },
  qrNote: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  actionsRow: { flexDirection: "row", gap: 10, width: "100%" },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#7C3AED",
  },
  actionBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: Colors.white,
  },
  emptyQR: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyQRText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
    maxWidth: 200,
  },
});

const scanStyles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 14 },
  permTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    color: Colors.text,
    textAlign: "center",
  },
  permText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  permBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  permBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: Colors.white,
  },
  cameraWrapper: { flex: 1, borderRadius: 0, overflow: "hidden" },
  camera: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  overlayHint: {
    fontFamily: "Poppins_500Medium",
    fontSize: 16,
    color: Colors.white,
  },
  frame: {
    width: 220,
    height: 220,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 4,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: Colors.white,
    borderWidth: 3,
  },
  cornerTL: { top: -2, left: -2, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: -2, right: -2, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: -2, left: -2, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: -2, right: -2, borderLeftWidth: 0, borderTopWidth: 0 },
  resultContent: { padding: 24, gap: 16, alignItems: "center" },
  successIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.successLight,
    justifyContent: "center",
    alignItems: "center",
  },
  resultTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 22,
    color: Colors.text,
  },
  resultCard: {
    width: "100%",
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  resultText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: Colors.text,
    lineHeight: 22,
  },
  resultActions: { flexDirection: "row", gap: 12, width: "100%" },
  resultBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  resultBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: Colors.primary,
  },
});
