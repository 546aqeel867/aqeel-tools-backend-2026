import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Modal, Platform, Alert, Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ToolHeader from "@/components/ToolHeader";
import { Colors } from "@/constants/colors";

const ACCENT = "#0891B2";
const ACCENT_LIGHT = "#F0FDFF";
const STORE_KEY = "code_notes_v1";

function uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

interface Snippet {
  id: string; title: string; code: string; language: string;
  description: string; tags: string[]; pinned: boolean; createdAt: number;
}

const LANGUAGES = [
  { id: "js",   label: "JavaScript", color: "#F7DF1E", bg: "#FFFDE7" },
  { id: "ts",   label: "TypeScript", color: "#3178C6", bg: "#E8F4FD" },
  { id: "py",   label: "Python",     color: "#3776AB", bg: "#E8F4FD" },
  { id: "rn",   label: "React Native", color: "#61DAFB", bg: "#E0F7FA" },
  { id: "html", label: "HTML",       color: "#E34F26", bg: "#FBE9E7" },
  { id: "css",  label: "CSS",        color: "#1572B6", bg: "#E3F2FD" },
  { id: "sql",  label: "SQL",        color: "#4479A1", bg: "#E8F4FD" },
  { id: "sh",   label: "Shell",      color: "#4EAA25", bg: "#E8F5E9" },
  { id: "json", label: "JSON",       color: "#7C3AED", bg: "#F3EEFF" },
  { id: "other",label: "Other",      color: "#64748B", bg: "#F1F5F9" },
];

const LANG_MAP: Record<string, (typeof LANGUAGES)[0]> = Object.fromEntries(LANGUAGES.map((l) => [l.id, l]));

export default function CodeNotesScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [filterLang, setFilterLang] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<Snippet | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY).then((v) => {
      if (v) { try { setSnippets(JSON.parse(v)); } catch {} }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORE_KEY, JSON.stringify(snippets));
  }, [snippets, loaded]);

  const openNew = () => {
    setIsNew(true);
    setEditModal({ id: uid(), title: "", code: "", language: "js", description: "", tags: [], pinned: false, createdAt: Date.now() });
  };

  const save = (s: Snippet) => {
    if (!s.title.trim() || !s.code.trim()) { Alert.alert("Required", "Title and code are required."); return; }
    setSnippets((prev) => {
      if (isNew) return [s, ...prev];
      return prev.map((x) => x.id === s.id ? s : x);
    });
    setEditModal(null);
  };

  const del = (id: string) => {
    Alert.alert("Delete Snippet", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => setSnippets((prev) => prev.filter((x) => x.id !== id)) },
    ]);
  };

  const copy = async (s: Snippet) => {
    await Clipboard.setStringAsync(s.code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedId(s.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const togglePin = (id: string) => {
    Haptics.selectionAsync();
    setSnippets((prev) => prev.map((s) => s.id === id ? { ...s, pinned: !s.pinned } : s));
  };

  const filtered = snippets
    .filter((s) =>
      (!filterLang || s.language === filterLang) &&
      (!search || s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.code.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase()) ||
        s.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())))
    )
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.createdAt - a.createdAt);

  return (
    <View style={[st.container, { paddingTop: topPad }]}>
      <ToolHeader title="Code Snippets" subtitle="Save & search your code" accentColor={ACCENT} />

      <View style={st.toolbar}>
        <View style={st.searchBox}>
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
          <TextInput style={st.searchInput} value={search} onChangeText={setSearch} placeholder="Search snippets…" placeholderTextColor={Colors.textMuted} />
          {search ? <Pressable onPress={() => setSearch("")}><Ionicons name="close-circle" size={16} color={Colors.textMuted} /></Pressable> : null}
        </View>
        <Pressable onPress={openNew} style={st.addBtn}>
          <Ionicons name="add" size={20} color={Colors.white} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.langFilter}>
        <Pressable onPress={() => setFilterLang(null)} style={[st.langChip, !filterLang && st.langChipOn]}>
          <Text style={[st.langChipText, !filterLang && st.langChipTextOn]}>All</Text>
        </Pressable>
        {LANGUAGES.map((l) => (
          <Pressable key={l.id} onPress={() => setFilterLang(filterLang === l.id ? null : l.id)} style={[st.langChip, filterLang === l.id && { backgroundColor: l.bg, borderColor: l.color }]}>
            <Text style={[st.langChipText, filterLang === l.id && { color: l.color }]}>{l.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={st.list} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 && (
          <View style={st.empty}>
            <Text style={{ fontSize: 52 }}>{"</>"}</Text>
            <Text style={st.emptyTitle}>{snippets.length === 0 ? "No snippets yet" : "No results"}</Text>
            <Text style={st.emptyText}>{snippets.length === 0 ? "Tap + to save your first code snippet." : "Try a different search or filter."}</Text>
          </View>
        )}

        {filtered.map((s) => {
          const lang = LANG_MAP[s.language] || LANG_MAP["other"];
          return (
            <View key={s.id} style={st.card}>
              <View style={st.cardHeader}>
                <View style={[st.langTag, { backgroundColor: lang.bg }]}>
                  <Text style={[st.langTagText, { color: lang.color }]}>{lang.label}</Text>
                </View>
                {s.pinned && <Ionicons name="pin" size={13} color={ACCENT} />}
                <Text style={st.cardDate}>{new Date(s.createdAt).toLocaleDateString()}</Text>
              </View>
              <Text style={st.cardTitle} numberOfLines={1}>{s.title}</Text>
              {s.description ? <Text style={st.cardDesc} numberOfLines={1}>{s.description}</Text> : null}

              <View style={st.codeBlock}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <Text style={st.codeText} numberOfLines={5}>{s.code}</Text>
                </ScrollView>
              </View>

              {s.tags.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {s.tags.map((t) => (
                      <View key={t} style={st.tagChip}><Text style={st.tagChipText}>#{t}</Text></View>
                    ))}
                  </View>
                </ScrollView>
              )}

              <View style={st.cardActions}>
                <Pressable onPress={() => copy(s)} style={st.actionBtn}>
                  <Ionicons name={copiedId === s.id ? "checkmark" : "copy-outline"} size={15} color={copiedId === s.id ? Colors.success : Colors.textMuted} />
                  <Text style={[st.actionText, copiedId === s.id && { color: Colors.success }]}>{copiedId === s.id ? "Copied!" : "Copy"}</Text>
                </Pressable>
                <Pressable onPress={() => togglePin(s.id)} style={st.actionBtn}>
                  <Ionicons name={s.pinned ? "pin" : "pin-outline"} size={15} color={s.pinned ? ACCENT : Colors.textMuted} />
                  <Text style={[st.actionText, s.pinned && { color: ACCENT }]}>{s.pinned ? "Pinned" : "Pin"}</Text>
                </Pressable>
                <Pressable onPress={() => { setIsNew(false); setEditModal(s); }} style={st.actionBtn}>
                  <Ionicons name="pencil-outline" size={15} color={Colors.textMuted} />
                  <Text style={st.actionText}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => del(s.id)} style={st.actionBtn}>
                  <Ionicons name="trash-outline" size={15} color={Colors.error} />
                  <Text style={[st.actionText, { color: Colors.error }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {editModal && <SnippetEditModal snippet={editModal} isNew={isNew} onSave={save} onClose={() => setEditModal(null)} />}
    </View>
  );
}

function SnippetEditModal({ snippet, isNew, onSave, onClose }: {
  snippet: Snippet; isNew: boolean; onSave: (s: Snippet) => void; onClose: () => void;
}) {
  const [title, setTitle] = useState(snippet.title);
  const [code, setCode] = useState(snippet.code);
  const [lang, setLang] = useState(snippet.language);
  const [desc, setDesc] = useState(snippet.description);
  const [tagInput, setTagInput] = useState(snippet.tags.join(", "));

  const save = () => {
    const tags = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
    onSave({ ...snippet, title, code, language: lang, description: desc, tags });
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[st.container, { paddingTop: Platform.OS === "web" ? 67 : 44 }]}>
        <View style={st.editHeader}>
          <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={24} color={Colors.text} /></Pressable>
          <Text style={st.editTitle}>{isNew ? "New Snippet" : "Edit Snippet"}</Text>
          <Pressable onPress={save} style={st.saveBtn}><Text style={st.saveBtnText}>Save</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 60 }}>
          <Text style={st.fieldLabel}>Title *</Text>
          <TextInput style={st.fieldInput} value={title} onChangeText={setTitle} placeholder="e.g. Debounce hook" autoFocus />

          <Text style={st.fieldLabel}>Language</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {LANGUAGES.map((l) => (
                <Pressable key={l.id} onPress={() => setLang(l.id)} style={[st.langChip, lang === l.id && { backgroundColor: l.bg, borderColor: l.color }]}>
                  <Text style={[st.langChipText, lang === l.id && { color: l.color }]}>{l.label}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <Text style={st.fieldLabel}>Code *</Text>
          <TextInput
            style={st.codeInput}
            value={code}
            onChangeText={setCode}
            placeholder={"// Paste your code here…"}
            multiline
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={st.fieldLabel}>Description (optional)</Text>
          <TextInput style={st.fieldInput} value={desc} onChangeText={setDesc} placeholder="What does this code do?" />

          <Text style={st.fieldLabel}>Tags (comma separated)</Text>
          <TextInput style={st.fieldInput} value={tagInput} onChangeText={setTagInput} placeholder="hooks, async, utility" autoCapitalize="none" />
        </ScrollView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  toolbar: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.separator, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  searchInput: { flex: 1, fontFamily: "Poppins_400Regular", fontSize: 13, color: Colors.text },
  addBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: ACCENT, justifyContent: "center", alignItems: "center" },
  langFilter: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  langChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.separator, borderWidth: 1, borderColor: Colors.cardBorder },
  langChipOn: { backgroundColor: ACCENT_LIGHT, borderColor: ACCENT },
  langChipText: { fontFamily: "Poppins_500Medium", fontSize: 12, color: Colors.textSecondary },
  langChipTextOn: { color: ACCENT },
  list: { padding: 16, gap: 12, paddingBottom: 40 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyTitle: { fontFamily: "Poppins_700Bold", fontSize: 20, color: Colors.text },
  emptyText: { fontFamily: "Poppins_400Regular", fontSize: 13, color: Colors.textSecondary, textAlign: "center" },
  card: { backgroundColor: Colors.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.cardBorder, gap: 8 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  langTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  langTagText: { fontFamily: "Poppins_700Bold", fontSize: 10, letterSpacing: 0.5 },
  cardDate: { fontFamily: "Poppins_400Regular", fontSize: 10, color: Colors.textMuted, marginLeft: "auto" },
  cardTitle: { fontFamily: "Poppins_700Bold", fontSize: 15, color: Colors.text },
  cardDesc: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.textSecondary },
  codeBlock: { backgroundColor: "#0F172A", borderRadius: 10, padding: 12, maxHeight: 130 },
  codeText: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 12, color: "#E2E8F0", lineHeight: 20 },
  tagChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: ACCENT_LIGHT },
  tagChipText: { fontFamily: "Poppins_400Regular", fontSize: 11, color: ACCENT },
  cardActions: { flexDirection: "row", gap: 4, borderTopWidth: 1, borderTopColor: Colors.separator, paddingTop: 8, marginTop: 2 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 6 },
  actionText: { fontFamily: "Poppins_500Medium", fontSize: 11, color: Colors.textMuted },
  editHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder, backgroundColor: Colors.white },
  editTitle: { flex: 1, fontFamily: "Poppins_700Bold", fontSize: 18, color: Colors.text, textAlign: "center" },
  saveBtn: { backgroundColor: ACCENT, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  saveBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: Colors.white },
  fieldLabel: { fontFamily: "Poppins_500Medium", fontSize: 12, color: Colors.textSecondary },
  fieldInput: { backgroundColor: Colors.separator, borderRadius: 12, padding: 12, fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.cardBorder },
  codeInput: { backgroundColor: "#0F172A", borderRadius: 12, padding: 14, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 13, color: "#E2E8F0", minHeight: 200, textAlignVertical: "top", lineHeight: 22 },
});
