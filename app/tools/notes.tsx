import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Pressable,
  Platform,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import ToolHeader from "@/components/ToolHeader";
import { useApp, Note } from "@/contexts/AppContext";

const NOTE_TAGS = [
  { label: "Red", color: "#EF4444" },
  { label: "Orange", color: "#F97316" },
  { label: "Yellow", color: "#EAB308" },
  { label: "Green", color: "#22C55E" },
  { label: "Blue", color: "#3B82F6" },
  { label: "Purple", color: "#A855F7" },
  { label: "Pink", color: "#EC4899" },
];

function NoteCard({
  note,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  note: Note;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  const date = new Date(note.updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const tagColor = note.tag || null;
  const wordCount = note.content
    ? note.content.trim().split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <Pressable
      onPress={onEdit}
      style={({ pressed }) => [
        styles.noteCard,
        tagColor && { borderLeftColor: tagColor, borderLeftWidth: 4 },
        { opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={styles.noteTop}>
        <View style={[styles.noteIconBox, tagColor && { backgroundColor: tagColor + "22" }]}>
          {note.pinned ? (
            <MaterialCommunityIcons name="pin" size={17} color={tagColor || Colors.primary} />
          ) : (
            <Ionicons name="document-text-outline" size={17} color={tagColor || Colors.primary} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.noteTitle} numberOfLines={1}>
            {note.title || "Untitled"}
          </Text>
          <View style={styles.noteMeta}>
            <Text style={styles.noteDate}>{date}</Text>
            {wordCount > 0 && (
              <Text style={styles.noteWords}>{wordCount} words</Text>
            )}
          </View>
        </View>
        <View style={styles.noteActions}>
          <Pressable onPress={onTogglePin} hitSlop={8} style={[styles.iconAction, note.pinned && styles.iconActionActive]}>
            <MaterialCommunityIcons
              name={note.pinned ? "pin" : "pin-outline"}
              size={14}
              color={note.pinned ? Colors.white : Colors.textMuted}
            />
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={8} style={styles.deleteBtn}>
            <Feather name="trash-2" size={14} color={Colors.error} />
          </Pressable>
        </View>
      </View>
      {note.content ? (
        <Text style={styles.noteContent} numberOfLines={2}>
          {note.content}
        </Text>
      ) : null}
    </Pressable>
  );
}

function TagPicker({
  selected,
  onSelect,
}: {
  selected: string | undefined;
  onSelect: (color: string | undefined) => void;
}) {
  return (
    <View style={styles.tagPickerRow}>
      <Pressable
        onPress={() => onSelect(undefined)}
        style={[styles.tagDot, styles.tagDotNone, !selected && styles.tagDotSelected]}
      >
        <Feather name="x" size={10} color={Colors.textMuted} />
      </Pressable>
      {NOTE_TAGS.map((t) => (
        <Pressable
          key={t.color}
          onPress={() => onSelect(t.color)}
          style={[
            styles.tagDot,
            { backgroundColor: t.color },
            selected === t.color && styles.tagDotSelected,
          ]}
        >
          {selected === t.color && (
            <Ionicons name="checkmark" size={10} color="#fff" />
          )}
        </Pressable>
      ))}
    </View>
  );
}

export default function NotesScreen() {
  const insets = useSafeAreaInsets();
  const { notes, addNote, updateNote, deleteNote } = useApp();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"date" | "title">("date");

  const openNew = () => {
    setEditingNote(null);
    setTitle("");
    setContent("");
    setSelectedTag(undefined);
    setModalVisible(true);
  };

  const openEdit = (note: Note) => {
    setEditingNote(note);
    setTitle(note.title);
    setContent(note.content);
    setSelectedTag(note.tag);
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!title.trim() && !content.trim()) {
      Alert.alert("Empty Note", "Please add a title or content.");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (editingNote) {
      updateNote(editingNote.id, title.trim(), content.trim(), selectedTag, editingNote.pinned);
    } else {
      addNote(title.trim(), content.trim(), selectedTag);
    }
    setModalVisible(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Note", "Are you sure you want to delete this note?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deleteNote(id);
        },
      },
    ]);
  };

  const handleTogglePin = (note: Note) => {
    Haptics.selectionAsync();
    updateNote(note.id, note.title, note.content, note.tag, !note.pinned);
  };

  const sortedFiltered = useMemo(() => {
    let result = notes.filter((n) => {
      const matchSearch =
        !search ||
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.content.toLowerCase().includes(search.toLowerCase());
      const matchTag = !filterTag || n.tag === filterTag;
      return matchSearch && matchTag;
    });

    result = [...result].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      if (sortMode === "title") return (a.title || "").localeCompare(b.title || "");
      return b.updatedAt - a.updatedAt;
    });

    return result;
  }, [notes, search, filterTag, sortMode]);

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  return (
    <View style={styles.container}>
      <ToolHeader title="Smart Notes" subtitle="Notes with tags, pins & search" accentColor="#EA580C" />

      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={17} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search notes..."
            placeholderTextColor={Colors.textMuted}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => setSortMode((m) => (m === "date" ? "title" : "date"))}
          style={styles.sortBtn}
          hitSlop={6}
        >
          <Ionicons
            name={sortMode === "date" ? "calendar-outline" : "text-outline"}
            size={17}
            color={Colors.textSecondary}
          />
        </Pressable>
        <Pressable
          onPress={openNew}
          style={({ pressed }) => [
            styles.addBtn,
            { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] },
          ]}
        >
          <Ionicons name="add" size={22} color={Colors.white} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tagFilterRow}
        contentContainerStyle={styles.tagFilterContent}
      >
        <Pressable
          onPress={() => setFilterTag(null)}
          style={[styles.tagFilterChip, !filterTag && styles.tagFilterChipActive]}
        >
          <Text style={[styles.tagFilterText, !filterTag && styles.tagFilterTextActive]}>All</Text>
        </Pressable>
        {NOTE_TAGS.map((t) => {
          const active = filterTag === t.color;
          return (
            <Pressable
              key={t.color}
              onPress={() => setFilterTag(active ? null : t.color)}
              style={[
                styles.tagFilterChip,
                { borderColor: t.color },
                active && { backgroundColor: t.color },
              ]}
            >
              <View style={[styles.tagDotTiny, { backgroundColor: t.color, opacity: active ? 0 : 1, position: active ? "absolute" : "relative" }]} />
              <Text style={[styles.tagFilterText, active && { color: "#fff" }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {sortedFiltered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="edit-3" size={36} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>
            {notes.length === 0 ? "No notes yet" : "No results"}
          </Text>
          <Text style={styles.emptyText}>
            {notes.length === 0
              ? "Tap + to create your first note"
              : "Try a different search or tag filter"}
          </Text>
          {notes.length === 0 && (
            <Pressable onPress={openNew} style={styles.emptyBtn}>
              <Ionicons name="add" size={18} color={Colors.white} />
              <Text style={styles.emptyBtnText}>Create Note</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={sortedFiltered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!sortedFiltered.length}
          renderItem={({ item }) => (
            <NoteCard
              note={item}
              onEdit={() => openEdit(item)}
              onDelete={() => handleDelete(item.id)}
              onTogglePin={() => handleTogglePin(item)}
            />
          )}
          ListHeaderComponent={
            <View style={styles.countRow}>
              <Text style={styles.countText}>
                {sortedFiltered.length} {sortedFiltered.length === 1 ? "note" : "notes"}
                {sortedFiltered.filter((n) => n.pinned).length > 0
                  ? ` · ${sortedFiltered.filter((n) => n.pinned).length} pinned`
                  : ""}
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setModalVisible(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
              <Text style={styles.modalTitle}>{editingNote ? "Edit Note" : "New Note"}</Text>
              <Pressable onPress={handleSave} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Save</Text>
              </Pressable>
            </View>

            <View style={styles.tagSection}>
              <Text style={styles.tagLabel}>Tag color</Text>
              <TagPicker selected={selectedTag} onSelect={setSelectedTag} />
            </View>

            <ScrollView
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.titleRow, selectedTag && { borderLeftColor: selectedTag, borderLeftWidth: 3 }]}>
                <TextInput
                  style={styles.titleInput}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Note title..."
                  placeholderTextColor={Colors.textMuted}
                  maxLength={100}
                />
              </View>
              <TextInput
                style={styles.contentInput}
                value={content}
                onChangeText={setContent}
                placeholder="Start writing your note..."
                placeholderTextColor={Colors.textMuted}
                multiline
                textAlignVertical="top"
                autoFocus={!editingNote}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <Text style={styles.wordCountText}>
                {wordCount} {wordCount === 1 ? "word" : "words"}
                {content.length > 0 ? ` · ${content.length} chars` : ""}
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const CARD_SHADOW = {
  shadowColor: Colors.shadow,
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 6,
  elevation: 1,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
    height: 42,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...CARD_SHADOW,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: Colors.text,
  },
  sortBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    justifyContent: "center",
    alignItems: "center",
    ...CARD_SHADOW,
  },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EA580C",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#EA580C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  tagFilterRow: { maxHeight: 44 },
  tagFilterContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "center",
    paddingBottom: 6,
  },
  tagFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.white,
  },
  tagFilterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tagFilterText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  tagFilterTextActive: { color: Colors.white },
  tagDotTiny: { width: 8, height: 8, borderRadius: 4 },
  listContent: { paddingHorizontal: 16, gap: 10, paddingTop: 8 },
  countRow: { paddingVertical: 4 },
  countText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  noteCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 8,
    ...CARD_SHADOW,
  },
  noteTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  noteIconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  noteTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: Colors.text,
  },
  noteMeta: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 1 },
  noteDate: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
  },
  noteWords: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
  },
  noteActions: { flexDirection: "row", gap: 6, alignItems: "center" },
  iconAction: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.separator,
    justifyContent: "center",
    alignItems: "center",
  },
  iconActionActive: { backgroundColor: "#F59E0B" },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.errorLight,
    justifyContent: "center",
    alignItems: "center",
  },
  noteContent: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    paddingLeft: 44,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.separator,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    color: Colors.text,
  },
  emptyText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 240,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EA580C",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  emptyBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: Colors.white,
  },
  modal: { flex: 1, backgroundColor: Colors.white },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  modalTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: Colors.text,
  },
  saveBtn: {
    backgroundColor: "#EA580C",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: Colors.white,
  },
  tagSection: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    gap: 6,
  },
  tagLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  tagPickerRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  tagDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  tagDotNone: {
    backgroundColor: Colors.separator,
    borderColor: Colors.cardBorder,
  },
  tagDotSelected: {
    borderColor: Colors.text,
    transform: [{ scale: 1.15 }],
  },
  modalContent: { padding: 16, gap: 12, flexGrow: 1 },
  titleRow: { paddingLeft: 6 },
  titleInput: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 20,
    color: Colors.text,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    paddingVertical: 10,
  },
  contentInput: {
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    color: Colors.text,
    lineHeight: 24,
    minHeight: 280,
    flex: 1,
    paddingTop: 12,
  },
  modalFooter: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    alignItems: "flex-end",
  },
  wordCountText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
  },
});
