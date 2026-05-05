import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Modal, Platform, Animated, Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ToolHeader from "@/components/ToolHeader";
import { Colors } from "@/constants/colors";

const ACCENT = "#7C3AED";
const ACCENT_LIGHT = "#F3EEFF";
const STORE_KEY = "flashcards_v1";

function uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

interface Card { id: string; front: string; back: string; known: boolean; }
interface Deck { id: string; name: string; color: string; cards: Card[]; }

const DECK_COLORS = ["#7C3AED", "#2563EB", "#059669", "#DB2777", "#EA580C", "#0891B2"];

type View2 = "decks" | "study" | "manage";

export default function FlashcardScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [decks, setDecks] = useState<Deck[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View2>("decks");
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [deckModal, setDeckModal] = useState(false);
  const [cardModal, setCardModal] = useState<{ deckId: string; card?: Card } | null>(null);
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckColor, setNewDeckColor] = useState(DECK_COLORS[0]);
  const [cardFront, setCardFront] = useState("");
  const [cardBack, setCardBack] = useState("");

  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY).then((v) => {
      if (v) { try { setDecks(JSON.parse(v)); } catch {} }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORE_KEY, JSON.stringify(decks));
  }, [decks, loaded]);

  const flipCard = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(flipAnim, { toValue: flipped ? 0 : 1, useNativeDriver: true, tension: 60, friction: 8 }).start();
    setFlipped((f) => !f);
  };

  const frontInterp = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const backInterp = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });
  const frontOp = flipAnim.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [1, 1, 0, 0] });
  const backOp = flipAnim.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [0, 0, 1, 1] });

  const startStudy = (deck: Deck) => {
    if (deck.cards.length === 0) { Alert.alert("Empty deck", "Add some cards first!"); return; }
    setActiveDeck({ ...deck, cards: [...deck.cards].sort(() => Math.random() - 0.5) });
    setCardIndex(0);
    setFlipped(false);
    flipAnim.setValue(0);
    setView("study");
  };

  const nextCard = (known: boolean) => {
    if (!activeDeck) return;
    Haptics.impactAsync(known ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy);
    const updatedDeck = { ...activeDeck, cards: activeDeck.cards.map((c, i) => i === cardIndex ? { ...c, known } : c) };
    setActiveDeck(updatedDeck);
    if (cardIndex < activeDeck.cards.length - 1) {
      setCardIndex((i) => i + 1);
      setFlipped(false);
      flipAnim.setValue(0);
    } else {
      const knownCount = updatedDeck.cards.filter((c) => c.known).length;
      Alert.alert("Session Complete! 🎉", `You knew ${knownCount}/${updatedDeck.cards.length} cards.`, [
        { text: "Back", onPress: () => setView("decks") },
        { text: "Retry Unknown", onPress: () => { const unk = updatedDeck.cards.filter((c) => !c.known); if (unk.length === 0) { setView("decks"); return; } setActiveDeck({ ...updatedDeck, cards: unk }); setCardIndex(0); setFlipped(false); flipAnim.setValue(0); } },
      ]);
    }
  };

  const saveDeck = () => {
    if (!newDeckName.trim()) return;
    const d: Deck = { id: uid(), name: newDeckName.trim(), color: newDeckColor, cards: [] };
    setDecks((prev) => [...prev, d]);
    setNewDeckName("");
    setDeckModal(false);
  };

  const deleteDeck = (id: string) => {
    Alert.alert("Delete Deck", "This will delete all cards inside.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => setDecks((prev) => prev.filter((d) => d.id !== id)) },
    ]);
  };

  const saveCard = () => {
    if (!cardModal || !cardFront.trim() || !cardBack.trim()) return;
    setDecks((prev) => prev.map((d) => {
      if (d.id !== cardModal.deckId) return d;
      const existing = d.cards.find((c) => c.id === cardModal.card?.id);
      return {
        ...d,
        cards: existing
          ? d.cards.map((c) => c.id === cardModal.card?.id ? { ...c, front: cardFront.trim(), back: cardBack.trim() } : c)
          : [...d.cards, { id: uid(), front: cardFront.trim(), back: cardBack.trim(), known: false }],
      };
    }));
    setCardFront("");
    setCardBack("");
    setCardModal(null);
  };

  const deleteCard = (deckId: string, cardId: string) => {
    setDecks((prev) => prev.map((d) => d.id !== deckId ? d : { ...d, cards: d.cards.filter((c) => c.id !== cardId) }));
  };

  if (view === "study" && activeDeck) {
    const card = activeDeck.cards[cardIndex];
    const progress = (cardIndex + 1) / activeDeck.cards.length;

    return (
      <View style={[s.container, { paddingTop: topPad }]}>
        <View style={s.studyHeader}>
          <Pressable onPress={() => setView("decks")} style={s.backBtn}><Ionicons name="arrow-back" size={20} color={Colors.text} /></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.studyDeckName}>{activeDeck.name}</Text>
            <Text style={s.studyProgress}>{cardIndex + 1} / {activeDeck.cards.length}</Text>
          </View>
        </View>

        <View style={s.progressBarWrap}>
          <View style={[s.progressFill, { width: `${progress * 100}%` as any, backgroundColor: activeDeck.color }]} />
        </View>

        <View style={s.studyArea}>
          <Pressable onPress={flipCard} style={s.cardWrap}>
            <Animated.View style={[s.flashCard, { backfaceVisibility: "hidden", transform: [{ rotateY: frontInterp }], opacity: frontOp, borderColor: activeDeck.color }]}>
              <View style={[s.cardLabel, { backgroundColor: activeDeck.color + "20" }]}>
                <Text style={[s.cardLabelText, { color: activeDeck.color }]}>QUESTION</Text>
              </View>
              <Text style={s.cardText}>{card.front}</Text>
              <Text style={s.tapHint}>Tap to reveal answer</Text>
            </Animated.View>
            <Animated.View style={[s.flashCard, s.flashCardBack, { backfaceVisibility: "hidden", transform: [{ rotateY: backInterp }], opacity: backOp }]}>
              <View style={[s.cardLabel, { backgroundColor: "#ECFDF5" }]}>
                <Text style={[s.cardLabelText, { color: Colors.success }]}>ANSWER</Text>
              </View>
              <Text style={s.cardText}>{card.back}</Text>
            </Animated.View>
          </Pressable>

          <View style={s.studyBtns}>
            <Pressable onPress={() => nextCard(false)} style={[s.studyBtn, s.studyBtnNo]}>
              <Ionicons name="close" size={28} color={Colors.error} />
              <Text style={[s.studyBtnText, { color: Colors.error }]}>Still learning</Text>
            </Pressable>
            <Pressable onPress={() => nextCard(true)} style={[s.studyBtn, s.studyBtnYes]}>
              <Ionicons name="checkmark" size={28} color={Colors.success} />
              <Text style={[s.studyBtnText, { color: Colors.success }]}>Got it!</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (view === "manage" && activeDeck) {
    const deck = decks.find((d) => d.id === activeDeck.id) || activeDeck;
    return (
      <View style={[s.container, { paddingTop: topPad }]}>
        <View style={s.studyHeader}>
          <Pressable onPress={() => setView("decks")} style={s.backBtn}><Ionicons name="arrow-back" size={20} color={Colors.text} /></Pressable>
          <Text style={s.studyDeckName}>{deck.name}</Text>
          <Pressable onPress={() => { setCardFront(""); setCardBack(""); setCardModal({ deckId: deck.id }); }} style={[s.addCardBtn, { backgroundColor: deck.color }]}>
            <Ionicons name="add" size={20} color={Colors.white} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
          {deck.cards.length === 0 && (
            <View style={s.empty}>
              <Text style={{ fontSize: 44 }}>📝</Text>
              <Text style={s.emptyTitle}>No cards yet</Text>
              <Text style={s.emptyText}>Tap + to add your first flashcard.</Text>
            </View>
          )}
          {deck.cards.map((c) => (
            <View key={c.id} style={s.manageCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.manageQ}>{c.front}</Text>
                <Text style={s.manageA}>{c.back}</Text>
              </View>
              <View style={{ gap: 8 }}>
                <Pressable onPress={() => { setCardFront(c.front); setCardBack(c.back); setCardModal({ deckId: deck.id, card: c }); }} hitSlop={8}>
                  <Ionicons name="pencil-outline" size={16} color={Colors.textMuted} />
                </Pressable>
                <Pressable onPress={() => deleteCard(deck.id, c.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={16} color={Colors.error} />
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>

        {cardModal && (
          <Modal visible animationType="slide" transparent onRequestClose={() => setCardModal(null)}>
            <View style={s.overlay}>
              <View style={s.sheet}>
                <Text style={s.sheetTitle}>{cardModal.card ? "Edit Card" : "New Card"}</Text>
                <Text style={s.fieldLabel}>Front (Question)</Text>
                <TextInput style={s.fieldInput} value={cardFront} onChangeText={setCardFront} placeholder="What is React Native?" multiline autoFocus />
                <Text style={s.fieldLabel}>Back (Answer)</Text>
                <TextInput style={s.fieldInput} value={cardBack} onChangeText={setCardBack} placeholder="A framework for building native mobile apps with React." multiline />
                <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
                  <Pressable onPress={() => setCardModal(null)} style={s.cancelBtn}><Text style={s.cancelText}>Cancel</Text></Pressable>
                  <Pressable onPress={saveCard} style={[s.saveBtn, { backgroundColor: deck.color }]}><Text style={s.saveText}>Save</Text></Pressable>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <ToolHeader title="Flashcards" subtitle="Study smarter, remember longer" accentColor={ACCENT} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}>
        {decks.length === 0 && (
          <View style={s.empty}>
            <Text style={{ fontSize: 56 }}>🧠</Text>
            <Text style={s.emptyTitle}>No decks yet</Text>
            <Text style={s.emptyText}>Create your first deck to start studying!</Text>
          </View>
        )}
        {decks.map((d) => {
          const known = d.cards.filter((c) => c.known).length;
          return (
            <View key={d.id} style={[s.deckCard, { borderLeftColor: d.color, borderLeftWidth: 4 }]}>
              <Pressable onPress={() => startStudy(d)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View style={[s.deckIcon, { backgroundColor: d.color + "20" }]}>
                  <Text style={{ fontSize: 24 }}>🗂️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.deckName}>{d.name}</Text>
                  <Text style={s.deckMeta}>{d.cards.length} cards · {known} known</Text>
                  {d.cards.length > 0 && (
                    <View style={s.deckBar}>
                      <View style={[s.deckBarFill, { width: `${(known / d.cards.length) * 100}%` as any, backgroundColor: d.color }]} />
                    </View>
                  )}
                </View>
              </Pressable>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable onPress={() => { setActiveDeck(d); setView("manage"); }} style={s.iconBtn}>
                  <Ionicons name="pencil-outline" size={16} color={Colors.textMuted} />
                </Pressable>
                <Pressable onPress={() => deleteDeck(d.id)} style={s.iconBtn}>
                  <Ionicons name="trash-outline" size={16} color={Colors.error} />
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Pressable onPress={() => { setNewDeckName(""); setNewDeckColor(DECK_COLORS[0]); setDeckModal(true); }} style={s.fab}>
        <Ionicons name="add" size={26} color={Colors.white} />
      </Pressable>

      <Modal visible={deckModal} animationType="slide" transparent onRequestClose={() => setDeckModal(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>New Deck</Text>
            <Text style={s.fieldLabel}>Deck name</Text>
            <TextInput style={s.fieldInput} value={newDeckName} onChangeText={setNewDeckName} placeholder="e.g. Spanish Vocabulary" autoFocus />
            <Text style={s.fieldLabel}>Color</Text>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 4 }}>
              {DECK_COLORS.map((c) => (
                <Pressable key={c} onPress={() => setNewDeckColor(c)} style={[s.colorDot, { backgroundColor: c }, newDeckColor === c && s.colorDotOn]}>
                  {newDeckColor === c && <Ionicons name="checkmark" size={12} color={Colors.white} />}
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
              <Pressable onPress={() => setDeckModal(false)} style={s.cancelBtn}><Text style={s.cancelText}>Cancel</Text></Pressable>
              <Pressable onPress={saveDeck} style={[s.saveBtn, { backgroundColor: newDeckColor }]}><Text style={s.saveText}>Create</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  empty: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyTitle: { fontFamily: "Poppins_700Bold", fontSize: 20, color: Colors.text },
  emptyText: { fontFamily: "Poppins_400Regular", fontSize: 13, color: Colors.textSecondary, textAlign: "center" },
  deckCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.cardBorder, gap: 10 },
  deckIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  deckName: { fontFamily: "Poppins_600SemiBold", fontSize: 16, color: Colors.text },
  deckMeta: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  deckBar: { height: 4, backgroundColor: Colors.separator, borderRadius: 2, marginTop: 6, overflow: "hidden" },
  deckBarFill: { height: 4, borderRadius: 2 },
  iconBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.separator, justifyContent: "center", alignItems: "center" },
  fab: { position: "absolute", bottom: 32, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: ACCENT, justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  studyHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder, backgroundColor: Colors.white },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.separator, justifyContent: "center", alignItems: "center" },
  studyDeckName: { fontFamily: "Poppins_700Bold", fontSize: 18, color: Colors.text, flex: 1 },
  studyProgress: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.textSecondary },
  addCardBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center" },
  progressBarWrap: { height: 4, backgroundColor: Colors.separator },
  progressFill: { height: 4 },
  studyArea: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 28 },
  cardWrap: { width: "100%", height: 280 },
  flashCard: { position: "absolute", width: "100%", height: 280, backgroundColor: Colors.white, borderRadius: 24, padding: 24, justifyContent: "center", alignItems: "center", borderWidth: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 8, gap: 12 },
  flashCardBack: { backgroundColor: "#F0FDF4", borderColor: Colors.success },
  cardLabel: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  cardLabelText: { fontFamily: "Poppins_700Bold", fontSize: 10, letterSpacing: 1 },
  cardText: { fontFamily: "Poppins_600SemiBold", fontSize: 20, color: Colors.text, textAlign: "center", lineHeight: 30 },
  tapHint: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.textMuted, position: "absolute", bottom: 16 },
  studyBtns: { flexDirection: "row", gap: 16, width: "100%" },
  studyBtn: { flex: 1, alignItems: "center", paddingVertical: 16, borderRadius: 18, gap: 4 },
  studyBtnNo: { backgroundColor: "#FEF2F2", borderWidth: 1.5, borderColor: Colors.error + "40" },
  studyBtnYes: { backgroundColor: "#F0FDF4", borderWidth: 1.5, borderColor: Colors.success + "40" },
  studyBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 12 },
  manageCard: { flexDirection: "row", gap: 12, backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: "flex-start" },
  manageQ: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: Colors.text },
  manageA: { fontFamily: "Poppins_400Regular", fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 8 },
  sheetTitle: { fontFamily: "Poppins_700Bold", fontSize: 18, color: Colors.text, marginBottom: 4 },
  fieldLabel: { fontFamily: "Poppins_500Medium", fontSize: 12, color: Colors.textSecondary, marginTop: 6 },
  fieldInput: { backgroundColor: Colors.separator, borderRadius: 12, padding: 12, fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.cardBorder, minHeight: 44 },
  cancelBtn: { flex: 1, backgroundColor: Colors.separator, borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  cancelText: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: Colors.textSecondary },
  saveBtn: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  saveText: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: Colors.white },
  colorDot: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  colorDotOn: { transform: [{ scale: 1.2 }] },
});
