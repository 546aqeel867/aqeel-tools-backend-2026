import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView, Platform,
  Alert, Switch, Modal, Image, Animated, Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Camera as ExpoCamera } from "expo-camera";
import * as Location from "expo-location";
// expo-notifications push support removed from Expo Go in SDK 53 — wrap safely
let Notifications: { getPermissionsAsync: () => Promise<{status: string}>; requestPermissionsAsync: () => Promise<{status: string}> };
try {
  Notifications = require("expo-notifications");
} catch {
  const stub = async () => ({ status: "undetermined" as const });
  Notifications = { getPermissionsAsync: stub, requestPermissionsAsync: stub };
}
import * as MediaLibrary from "expo-media-library";
import { Colors } from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";

type PermStatus = "granted" | "denied" | "undetermined" | "checking";

interface PermInfo {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  status: PermStatus;
}

function usePermissions() {
  const [perms, setPerms] = useState<Record<string, PermStatus>>({
    camera: "checking",
    location: "checking",
    notifications: "checking",
    mediaLibrary: "checking",
    microphone: "checking",
  });

  const refresh = useCallback(async () => {
    try {
      const [cam, loc, notif, media, mic] = await Promise.all([
        ExpoCamera.getCameraPermissionsAsync(),
        Location.getForegroundPermissionsAsync(),
        Notifications.getPermissionsAsync(),
        MediaLibrary.getPermissionsAsync(),
        ExpoCamera.getMicrophonePermissionsAsync(),
      ]);
      setPerms({
        camera:        cam.status   === "granted" ? "granted" : cam.status   === "denied" ? "denied" : "undetermined",
        location:      loc.status   === "granted" ? "granted" : loc.status   === "denied" ? "denied" : "undetermined",
        notifications: notif.status === "granted" ? "granted" : notif.status === "denied" ? "denied" : "undetermined",
        mediaLibrary:  media.status === "granted" ? "granted" : media.status === "denied" ? "denied" : "undetermined",
        microphone:    mic.status   === "granted" ? "granted" : mic.status   === "denied" ? "denied" : "undetermined",
      });
    } catch {
      setPerms({ camera: "undetermined", location: "undetermined", notifications: "undetermined", mediaLibrary: "undetermined", microphone: "undetermined" });
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const request = useCallback(async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      let result: { status: string };
      switch (id) {
        case "camera":        result = await ExpoCamera.requestCameraPermissionsAsync(); break;
        case "location":      result = await Location.requestForegroundPermissionsAsync(); break;
        case "notifications": result = await Notifications.requestPermissionsAsync(); break;
        case "mediaLibrary":  result = await MediaLibrary.requestPermissionsAsync(); break;
        case "microphone":    result = await ExpoCamera.requestMicrophonePermissionsAsync(); break;
        default: return;
      }
      setPerms((p) => ({ ...p, [id]: result.status === "granted" ? "granted" : "denied" }));
      if (result.status === "granted") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert(
          "Permission Denied",
          "To enable this, go to your device Settings and allow the permission for Aqeel Tools Hub.",
          [{ text: "OK" }]
        );
      }
    } catch {
      await refresh();
    }
  }, [refresh]);

  return { perms, request, refresh };
}

function PermissionRow({ perm, onRequest }: { perm: PermInfo; onRequest: (id: string) => void }) {
  const isGranted = perm.status === "granted";
  const isDenied = perm.status === "denied";
  const isChecking = perm.status === "checking";

  const dot = isGranted ? "#10B981" : isDenied ? Colors.error : "#F59E0B";
  const label = isGranted ? "Granted" : isDenied ? "Denied" : isChecking ? "Checking…" : "Not Asked";

  return (
    <View style={ps.permRow}>
      <View style={[ps.permIcon, { backgroundColor: perm.color + "18" }]}>
        <Ionicons name={perm.icon as any} size={18} color={perm.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ps.permLabel}>{perm.label}</Text>
        <Text style={ps.permDesc}>{perm.description}</Text>
      </View>
      <Pressable
        onPress={() => !isGranted && onRequest(perm.id)}
        disabled={isGranted || isChecking}
        style={[ps.permBadge, { backgroundColor: dot + "18", borderColor: dot + "40" }]}
      >
        <View style={[ps.permDot, { backgroundColor: dot }]} />
        <Text style={[ps.permBadgeText, { color: dot }]}>{label}</Text>
      </Pressable>
    </View>
  );
}

function AvatarPickerModal({ visible, onClose, currentEmoji, currentColor, onSave }: {
  visible: boolean; onClose: () => void; currentEmoji: string; currentColor: string;
  onSave: (emoji: string, color: string) => void;
}) {
  const { AVATAR_EMOJIS, AVATAR_COLORS } = useApp();
  const [selectedEmoji, setSelectedEmoji] = useState(currentEmoji);
  const [selectedColor, setSelectedColor] = useState(currentColor);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={ps.overlay} onPress={onClose}>
        <Pressable style={ps.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={ps.sheetHandle} />
          <Text style={ps.sheetTitle}>Choose Avatar</Text>
          <View style={[ps.previewCircle, { backgroundColor: selectedColor }]}>
            <Text style={ps.previewEmoji}>{selectedEmoji}</Text>
          </View>
          <Text style={ps.sheetLabel}>Emoji</Text>
          <View style={ps.emojiGrid}>
            {AVATAR_EMOJIS.map((emoji) => (
              <Pressable key={emoji} onPress={() => { setSelectedEmoji(emoji); Haptics.selectionAsync(); }}
                style={[ps.emojiBtn, selectedEmoji === emoji && { backgroundColor: Colors.primary + "20", borderColor: Colors.primary }]}>
                <Text style={{ fontSize: 22 }}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={ps.sheetLabel}>Background Color</Text>
          <View style={ps.colorRow}>
            {AVATAR_COLORS.map((c) => (
              <Pressable key={c} onPress={() => { setSelectedColor(c); Haptics.selectionAsync(); }}
                style={[ps.colorDot, { backgroundColor: c }, selectedColor === c && ps.colorDotSelected]} />
            ))}
          </View>
          <View style={ps.sheetActions}>
            <Pressable onPress={onClose} style={ps.cancelBtn}>
              <Text style={ps.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={() => { onSave(selectedEmoji, selectedColor); onClose(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }} style={ps.saveBtn}>
              <Text style={ps.saveBtnText}>Save Avatar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function AddProfileModal({ visible, onClose, onAdd }: {
  visible: boolean; onClose: () => void;
  onAdd: (name: string, email: string, emoji: string, color: string) => void;
}) {
  const { AVATAR_EMOJIS, AVATAR_COLORS } = useApp();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emoji, setEmoji] = useState("😎");
  const [color, setColor] = useState("#7C3AED");

  const handleAdd = () => {
    if (!name.trim()) { Alert.alert("Required", "Please enter a display name."); return; }
    onAdd(name.trim(), email.trim(), emoji, color);
    setName(""); setEmail(""); setEmoji("😎"); setColor("#7C3AED");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={ps.overlay} onPress={onClose}>
        <Pressable style={ps.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={ps.sheetHandle} />
          <Text style={ps.sheetTitle}>New Profile</Text>
          <View style={[ps.previewCircle, { backgroundColor: color }]}>
            <Text style={ps.previewEmoji}>{emoji}</Text>
          </View>
          <View style={ps.emojiGrid}>
            {AVATAR_EMOJIS.map((e) => (
              <Pressable key={e} onPress={() => setEmoji(e)}
                style={[ps.emojiBtn, emoji === e && { backgroundColor: Colors.primary + "20", borderColor: Colors.primary }]}>
                <Text style={{ fontSize: 22 }}>{e}</Text>
              </Pressable>
            ))}
          </View>
          <View style={ps.colorRow}>
            {AVATAR_COLORS.map((c) => (
              <Pressable key={c} onPress={() => setColor(c)}
                style={[ps.colorDot, { backgroundColor: c }, color === c && ps.colorDotSelected]} />
            ))}
          </View>
          <TextInput value={name} onChangeText={setName} placeholder="Display name *" placeholderTextColor={Colors.textMuted}
            style={ps.modalInput} maxLength={20} />
          <TextInput value={email} onChangeText={setEmail} placeholder="Email (optional)"
            placeholderTextColor={Colors.textMuted} style={ps.modalInput} keyboardType="email-address" autoCapitalize="none" />
          <View style={ps.sheetActions}>
            <Pressable onPress={onClose} style={ps.cancelBtn}>
              <Text style={ps.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleAdd} style={ps.saveBtn}>
              <Text style={ps.saveBtnText}>Add Profile</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={ps.section}>
      {title && <Text style={ps.sectionTitle}>{title}</Text>}
      <View style={ps.card}>{children}</View>
    </View>
  );
}

function SettingRow({ icon, iconColor, label, description, value, onChange, last }: {
  icon: string; iconColor: string; label: string; description?: string;
  value: boolean; onChange: (v: boolean) => void; last?: boolean;
}) {
  return (
    <View style={[ps.row, last && { borderBottomWidth: 0 }]}>
      <View style={[ps.rowIcon, { backgroundColor: iconColor + "18" }]}>
        <Ionicons name={icon as any} size={17} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ps.rowLabel}>{label}</Text>
        {description && <Text style={ps.rowDesc}>{description}</Text>}
      </View>
      <Switch value={value} onValueChange={(v) => { Haptics.selectionAsync(); onChange(v); }}
        trackColor={{ false: Colors.cardBorder, true: Colors.primary }}
        thumbColor={Colors.white} ios_backgroundColor={Colors.cardBorder} />
    </View>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[ps.row, last && { borderBottomWidth: 0 }]}>
      <Text style={ps.rowLabel}>{label}</Text>
      <Text style={ps.infoValue}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  const {
    username, setUsername, email, toolsUsedCount, notes, settings, updateSetting, logout, changePassword,
    avatarEmoji, avatarColor, avatarPhoto, setAvatar, setAvatarPhoto,
    profileSlots, addProfileSlot, removeProfileSlot,
    chatSessions,
  } = useApp();

  const { perms, request, refresh } = usePermissions();

  const [editingName, setEditingName] = useState(false);
  const [inputName, setInputName] = useState(username);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const totalChats = chatSessions.reduce((s, c) => s + c.messages.length, 0);

  const handleUploadPhoto = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Needed", "Please allow photo library access to upload a profile photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      await setAvatarPhoto(result.assets[0].uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleSaveName = async () => {
    if (!inputName.trim()) { Alert.alert("Error", "Name cannot be empty."); return; }
    await setUsername(inputName.trim());
    setEditingName(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd || !confirmPwd) { Alert.alert("Error", "Please fill all fields."); return; }
    if (newPwd !== confirmPwd) { Alert.alert("Error", "New passwords do not match."); return; }
    if (newPwd.length < 6) { Alert.alert("Error", "Password must be at least 6 characters."); return; }
    setPwdLoading(true);
    const result = await changePassword(currentPwd, newPwd);
    setPwdLoading(false);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Done", "Password changed successfully!");
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
      setShowSecurity(false);
    } else {
      Alert.alert("Error", result.error || "Password change failed.");
    }
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        await logout();
      }},
    ]);
  };

  const handleAddProfile = async (name: string, em: string, emoji: string, color: string) => {
    const result = await addProfileSlot(name, em, emoji, color);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert("Error", result.error || "Failed to add profile.");
    }
  };

  const handleRemoveProfile = (id: string, name: string) => {
    Alert.alert("Remove Profile", `Remove "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeProfileSlot(id) },
    ]);
  };

  const PERMISSION_DEFS: PermInfo[] = [
    { id: "camera",        label: "Camera",        description: "QR scanner, photo capture",          icon: "camera-outline",        color: "#7C3AED", status: perms.camera },
    { id: "microphone",    label: "Microphone",    description: "Voice memos, speech recognition",    icon: "mic-outline",           color: "#DB2777", status: perms.microphone },
    { id: "location",      label: "Location",      description: "Trip planner, local features",       icon: "location-outline",      color: "#059669", status: perms.location },
    { id: "mediaLibrary",  label: "Photo Library", description: "Photo editor, media tools",          icon: "images-outline",        color: "#D97706", status: perms.mediaLibrary },
    { id: "notifications", label: "Notifications", description: "App updates, reminders",             icon: "notifications-outline", color: "#0891B2", status: perms.notifications },
  ];

  const grantedCount = Object.values(perms).filter((s) => s === "granted").length;

  return (
    <ScrollView
      style={[ps.root, { paddingTop: topPad }]}
      contentContainerStyle={[ps.content, { paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={ps.screenTitle}>Profile</Text>

      {/* ── Avatar & Identity ── */}
      <View style={ps.heroCard}>
        <View style={ps.avatarArea}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Pressable
              onPress={() => avatarPhoto ? Alert.alert("Photo", "Remove or change?", [
                { text: "Change Photo", onPress: handleUploadPhoto },
                { text: "Use Emoji", style: "destructive", onPress: async () => { await setAvatarPhoto(""); Haptics.selectionAsync(); } },
                { text: "Cancel", style: "cancel" },
              ]) : setShowAvatarPicker(true)}
              style={[ps.avatar, { backgroundColor: avatarPhoto ? "transparent" : avatarColor }]}
            >
              {avatarPhoto
                ? <Image source={{ uri: avatarPhoto }} style={ps.avatarImg} />
                : <Text style={ps.avatarEmoji}>{avatarEmoji}</Text>}
            </Pressable>
          </Animated.View>
          <Pressable onPress={handleUploadPhoto} style={ps.cameraBtn}>
            <Ionicons name="camera" size={12} color={Colors.white} />
          </Pressable>
        </View>

        {editingName ? (
          <View style={ps.editRow}>
            <TextInput value={inputName} onChangeText={setInputName} style={ps.nameInput}
              placeholder="Display name" placeholderTextColor={Colors.textMuted}
              autoFocus maxLength={30} returnKeyType="done" onSubmitEditing={handleSaveName} />
            <Pressable onPress={handleSaveName} style={ps.iconBtnGreen}>
              <Ionicons name="checkmark" size={16} color={Colors.white} />
            </Pressable>
            <Pressable onPress={() => { setEditingName(false); setInputName(username); }} style={ps.iconBtnGray}>
              <Ionicons name="close" size={16} color={Colors.textSecondary} />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => { setEditingName(true); setInputName(username); }} style={ps.nameRow}>
            <Text style={ps.heroName}>{username}</Text>
            <Ionicons name="pencil-outline" size={14} color={Colors.primary} style={{ marginLeft: 6 }} />
          </Pressable>
        )}

        <Text style={ps.heroEmail}>{email || "No email set"}</Text>
        <View style={ps.memberBadge}>
          <MaterialCommunityIcons name="shield-star-outline" size={13} color={Colors.primary} />
          <Text style={ps.memberBadgeText}>Aqeel Tools Hub Member</Text>
        </View>

        <View style={ps.avatarBtns}>
          <Pressable onPress={handleUploadPhoto} style={[ps.avatarBtn, { backgroundColor: "#10B981" + "15", borderColor: "#10B981" + "50" }]}>
            <Ionicons name="cloud-upload-outline" size={13} color="#10B981" />
            <Text style={[ps.avatarBtnText, { color: "#10B981" }]}>Photo</Text>
          </Pressable>
          <Pressable onPress={() => setShowAvatarPicker(true)} style={ps.avatarBtn}>
            <Ionicons name="color-palette-outline" size={13} color={Colors.primary} />
            <Text style={ps.avatarBtnText}>Emoji</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Stats ── */}
      <View style={ps.statsRow}>
        {[
          { label: "Tools Used", value: toolsUsedCount, icon: "checkmark-circle-outline" as const, color: Colors.primary },
          { label: "Messages", value: totalChats, icon: "chatbubbles-outline" as const, color: "#EA580C" },
          { label: "Notes", value: notes.length, icon: "document-text-outline" as const, color: "#7C3AED" },
        ].map((s) => (
          <View key={s.label} style={ps.statCard}>
            <Ionicons name={s.icon} size={18} color={s.color} />
            <Text style={[ps.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={ps.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Profiles ── */}
      <SectionCard title={`Profiles  ${profileSlots.length + 1}/3`}>
        <View style={[ps.row, { borderBottomWidth: profileSlots.length > 0 ? 1 : 0 }]}>
          <View style={[ps.avatar32, { backgroundColor: avatarColor }]}>
            <Text style={{ fontSize: 15 }}>{avatarEmoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={ps.rowLabel}>{username}</Text>
              <View style={ps.activePill}><Text style={ps.activePillText}>Active</Text></View>
            </View>
            <Text style={ps.rowDesc}>{email || "No email"}</Text>
          </View>
        </View>
        {profileSlots.map((slot, i) => (
          <View key={slot.id} style={[ps.row, { borderBottomWidth: i < profileSlots.length - 1 ? 1 : 0 }]}>
            <View style={[ps.avatar32, { backgroundColor: slot.avatarColor }]}>
              <Text style={{ fontSize: 15 }}>{slot.avatarEmoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ps.rowLabel}>{slot.username}</Text>
              <Text style={ps.rowDesc}>{slot.email || "No email"}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Pressable onPress={() => handleRemoveProfile(slot.id, slot.username)} hitSlop={8}
                style={[ps.rowAction, { backgroundColor: Colors.error + "15" }]}>
                <Ionicons name="trash-outline" size={14} color={Colors.error} />
              </Pressable>
            </View>
          </View>
        ))}
        {profileSlots.length < 2 && (
          <Pressable onPress={() => setShowAddProfile(true)} style={ps.addProfileRow}>
            <View style={ps.addProfileIcon}><Ionicons name="add" size={16} color={Colors.textMuted} /></View>
            <Text style={ps.addProfileText}>Add another profile</Text>
          </Pressable>
        )}
      </SectionCard>

      {/* ── App Permissions ── */}
      <View style={ps.section}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={ps.sectionTitle}>App Permissions</Text>
          <View style={[ps.permCountBadge, { backgroundColor: grantedCount === 5 ? "#10B981" + "18" : Colors.primary + "15" }]}>
            <Text style={[ps.permCountText, { color: grantedCount === 5 ? "#10B981" : Colors.primary }]}>
              {grantedCount}/5 granted
            </Text>
          </View>
        </View>
        <View style={ps.card}>
          {PERMISSION_DEFS.map((perm, i) => (
            <View key={perm.id} style={[{ borderBottomWidth: i < PERMISSION_DEFS.length - 1 ? 1 : 0, borderBottomColor: Colors.cardBorder }]}>
              <PermissionRow perm={perm} onRequest={request} />
            </View>
          ))}
        </View>
      </View>

      {/* ── Privacy ── */}
      <SectionCard title="Privacy">
        <SettingRow icon="analytics-outline" iconColor={Colors.primary} label="Usage Analytics"
          description="Anonymous data helps improve the app" value={settings.dataCollection}
          onChange={(v) => updateSetting("dataCollection", v)} />
        <SettingRow icon="location-outline" iconColor="#059669" label="Location Access"
          description="Used by Trip Planner" value={settings.locationAccess}
          onChange={(v) => updateSetting("locationAccess", v)} />
        <SettingRow icon="notifications-outline" iconColor="#DB2777" label="Push Notifications"
          description="Tips, updates & reminders" value={settings.notifications}
          onChange={(v) => updateSetting("notifications", v)} />
        <SettingRow icon="megaphone-outline" iconColor="#D97706" label="Show Ads"
          description="Helps keep the app free" value={settings.adsEnabled}
          onChange={(v) => updateSetting("adsEnabled", v)} last />
      </SectionCard>

      {/* ── Security ── */}
      <SectionCard title="Security">
        <Pressable onPress={() => { setShowSecurity((v) => !v); Haptics.selectionAsync(); }}
          style={[ps.row, { borderBottomWidth: 0 }]}>
          <View style={[ps.rowIcon, { backgroundColor: Colors.primaryLight }]}>
            <Ionicons name="lock-closed-outline" size={17} color={Colors.primary} />
          </View>
          <Text style={[ps.rowLabel, { flex: 1 }]}>Change Password</Text>
          <Ionicons name={showSecurity ? "chevron-up" : "chevron-down"} size={17} color={Colors.textMuted} />
        </Pressable>
        {showSecurity && (
          <View style={ps.securityBlock}>
            {([
              { label: "Current Password", value: currentPwd, set: setCurrentPwd, ph: "Current password" },
              { label: "New Password",      value: newPwd,     set: setNewPwd,     ph: "Min 6 characters" },
              { label: "Confirm New",       value: confirmPwd, set: setConfirmPwd, ph: "Repeat new password" },
            ] as const).map((f) => (
              <View key={f.label} style={ps.pwdField}>
                <Text style={ps.pwdLabel}>{f.label}</Text>
                <TextInput style={ps.pwdInput} value={f.value} onChangeText={f.set}
                  placeholder={f.ph} placeholderTextColor={Colors.textMuted} secureTextEntry />
              </View>
            ))}
            <Pressable onPress={handleChangePassword} disabled={pwdLoading}
              style={({ pressed }) => [ps.pwdBtn, { opacity: pwdLoading || pressed ? 0.8 : 1 }]}>
              <Ionicons name="shield-checkmark-outline" size={16} color={Colors.white} />
              <Text style={ps.pwdBtnText}>{pwdLoading ? "Updating…" : "Update Password"}</Text>
            </Pressable>
          </View>
        )}
      </SectionCard>

      {/* ── App Info ── */}
      <SectionCard title="About">
        <InfoRow label="App" value="Aqeel Tools Hub" />
        <InfoRow label="Version" value="2.1.0" />
        <InfoRow label="AI Model" value="Zeno V2 (Mistral)" />
        <InfoRow label="Platform" value={Platform.OS === "ios" ? "iOS" : Platform.OS === "android" ? "Android" : "Web"} />
        <InfoRow label="Developer" value="Aqeel" last />
      </SectionCard>

      {/* ── Sign Out ── */}
      <Pressable onPress={handleLogout} style={({ pressed }) => [ps.logoutBtn, { opacity: pressed ? 0.8 : 1 }]}>
        <Ionicons name="log-out-outline" size={19} color={Colors.error} />
        <Text style={ps.logoutText}>Sign Out</Text>
      </Pressable>

      <AvatarPickerModal visible={showAvatarPicker} onClose={() => setShowAvatarPicker(false)}
        currentEmoji={avatarEmoji} currentColor={avatarColor} onSave={setAvatar} />
      <AddProfileModal visible={showAddProfile} onClose={() => setShowAddProfile(false)} onAdd={handleAddProfile} />
    </ScrollView>
  );
}

const SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 2,
};

const ps = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 16, gap: 16 },
  screenTitle: { fontFamily: "Poppins_700Bold", fontSize: 26, color: Colors.text, paddingTop: 20 },

  // Hero card
  heroCard: { backgroundColor: Colors.white, borderRadius: 24, padding: 24, alignItems: "center", gap: 6, borderWidth: 1, borderColor: Colors.cardBorder, ...SHADOW },
  avatarArea: { position: "relative", marginBottom: 4 },
  avatar: { width: 88, height: 88, borderRadius: 44, justifyContent: "center", alignItems: "center", overflow: "hidden", borderWidth: 3, borderColor: Colors.primary + "30" },
  avatarImg: { width: 88, height: 88, borderRadius: 44 },
  avatarEmoji: { fontSize: 38 },
  cameraBtn: { position: "absolute", bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: "#10B981", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: Colors.white },
  editRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nameInput: { flex: 1, fontFamily: "Poppins_600SemiBold", fontSize: 18, color: Colors.text, borderBottomWidth: 2, borderBottomColor: Colors.primary, paddingVertical: 2, paddingHorizontal: 4 },
  iconBtnGreen: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.primary, justifyContent: "center", alignItems: "center" },
  iconBtnGray: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.cardBorder, justifyContent: "center", alignItems: "center" },
  nameRow: { flexDirection: "row", alignItems: "center" },
  heroName: { fontFamily: "Poppins_700Bold", fontSize: 20, color: Colors.text },
  heroEmail: { fontFamily: "Poppins_400Regular", fontSize: 13, color: Colors.textSecondary, marginTop: -2 },
  memberBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.primaryLight, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 4 },
  memberBadgeText: { fontFamily: "Poppins_600SemiBold", fontSize: 11, color: Colors.primary },
  avatarBtns: { flexDirection: "row", gap: 10, marginTop: 8 },
  avatarBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: Colors.primary + "40" },
  avatarBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: Colors.primary },

  // Stats
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, backgroundColor: Colors.white, borderRadius: 16, padding: 14, alignItems: "center", gap: 4, borderWidth: 1, borderColor: Colors.cardBorder, ...SHADOW },
  statValue: { fontFamily: "Poppins_700Bold", fontSize: 20 },
  statLabel: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textMuted, textAlign: "center" },

  // Section / card
  section: { gap: 8 },
  sectionTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: Colors.textSecondary, letterSpacing: 0.3, marginLeft: 4 },
  card: { backgroundColor: Colors.white, borderRadius: 18, borderWidth: 1, borderColor: Colors.cardBorder, overflow: "hidden", ...SHADOW },

  // Rows
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  rowIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  rowLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: Colors.text },
  rowDesc: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  infoValue: { fontFamily: "Poppins_500Medium", fontSize: 13, color: Colors.textSecondary, marginLeft: "auto" },
  rowAction: { width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center" },

  // Profiles
  avatar32: { width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center" },
  activePill: { backgroundColor: Colors.primary + "18", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  activePillText: { fontFamily: "Poppins_600SemiBold", fontSize: 10, color: Colors.primary },
  addProfileRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  addProfileIcon: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: Colors.cardBorder, borderStyle: "dashed", justifyContent: "center", alignItems: "center" },
  addProfileText: { fontFamily: "Poppins_500Medium", fontSize: 14, color: Colors.textMuted },

  // Permissions
  permCountBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  permCountText: { fontFamily: "Poppins_600SemiBold", fontSize: 11 },
  permRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  permIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  permLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: Colors.text },
  permDesc: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  permBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  permDot: { width: 6, height: 6, borderRadius: 3 },
  permBadgeText: { fontFamily: "Poppins_600SemiBold", fontSize: 11 },

  // Security
  securityBlock: { borderTopWidth: 1, borderTopColor: Colors.cardBorder, padding: 16, gap: 12 },
  pwdField: { gap: 4 },
  pwdLabel: { fontFamily: "Poppins_500Medium", fontSize: 12, color: Colors.textSecondary },
  pwdInput: { backgroundColor: Colors.background, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.cardBorder },
  pwdBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 13 },
  pwdBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: Colors.white },

  // Sign out
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.white, borderRadius: 18, paddingVertical: 15, borderWidth: 1.5, borderColor: Colors.error + "40", ...SHADOW },
  logoutText: { fontFamily: "Poppins_600SemiBold", fontSize: 15, color: Colors.error },

  // Modals
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12, gap: 12 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: Colors.cardBorder, alignSelf: "center", marginBottom: 4 },
  sheetTitle: { fontFamily: "Poppins_700Bold", fontSize: 18, color: Colors.text, textAlign: "center" },
  sheetLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: Colors.textSecondary, letterSpacing: 0.3 },
  previewCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center", alignSelf: "center" },
  previewEmoji: { fontSize: 32 },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emojiBtn: { width: 46, height: 46, borderRadius: 12, justifyContent: "center", alignItems: "center", backgroundColor: Colors.background, borderWidth: 1.5, borderColor: "transparent" },
  colorRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotSelected: { borderWidth: 3, borderColor: Colors.text },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, backgroundColor: Colors.background, borderRadius: 14, paddingVertical: 13, alignItems: "center", borderWidth: 1, borderColor: Colors.cardBorder },
  cancelBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: Colors.textSecondary },
  saveBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  saveBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: Colors.white },
  modalInput: { backgroundColor: Colors.background, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.cardBorder },
});
