import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Platform, Modal, FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ToolHeader from "@/components/ToolHeader";
import { Colors } from "@/constants/colors";

const ACCENT = "#0891B2";
const ACCENT_LIGHT = "#F0FDFF";
const STORE_KEY = "world_clocks_v1";

interface ClockZone {
  id: string;
  city: string;
  tz: string;
  flag: string;
}

const ALL_ZONES: ClockZone[] = [
  { id: "nyc",     city: "New York",       tz: "America/New_York",    flag: "🇺🇸" },
  { id: "la",      city: "Los Angeles",    tz: "America/Los_Angeles", flag: "🇺🇸" },
  { id: "chicago", city: "Chicago",        tz: "America/Chicago",     flag: "🇺🇸" },
  { id: "toronto", city: "Toronto",        tz: "America/Toronto",     flag: "🇨🇦" },
  { id: "london",  city: "London",         tz: "Europe/London",       flag: "🇬🇧" },
  { id: "paris",   city: "Paris",          tz: "Europe/Paris",        flag: "🇫🇷" },
  { id: "berlin",  city: "Berlin",         tz: "Europe/Berlin",       flag: "🇩🇪" },
  { id: "dubai",   city: "Dubai",          tz: "Asia/Dubai",          flag: "🇦🇪" },
  { id: "riyadh",  city: "Riyadh",         tz: "Asia/Riyadh",         flag: "🇸🇦" },
  { id: "karachi", city: "Karachi",        tz: "Asia/Karachi",        flag: "🇵🇰" },
  { id: "delhi",   city: "New Delhi",      tz: "Asia/Kolkata",        flag: "🇮🇳" },
  { id: "dhaka",   city: "Dhaka",          tz: "Asia/Dhaka",          flag: "🇧🇩" },
  { id: "bangkok", city: "Bangkok",        tz: "Asia/Bangkok",        flag: "🇹🇭" },
  { id: "sg",      city: "Singapore",      tz: "Asia/Singapore",      flag: "🇸🇬" },
  { id: "hk",      city: "Hong Kong",      tz: "Asia/Hong_Kong",      flag: "🇭🇰" },
  { id: "beijing", city: "Beijing",        tz: "Asia/Shanghai",       flag: "🇨🇳" },
  { id: "tokyo",   city: "Tokyo",          tz: "Asia/Tokyo",          flag: "🇯🇵" },
  { id: "sydney",  city: "Sydney",         tz: "Australia/Sydney",    flag: "🇦🇺" },
  { id: "auck",    city: "Auckland",       tz: "Pacific/Auckland",    flag: "🇳🇿" },
  { id: "moscow",  city: "Moscow",         tz: "Europe/Moscow",       flag: "🇷🇺" },
  { id: "istanbul",city: "Istanbul",       tz: "Europe/Istanbul",     flag: "🇹🇷" },
  { id: "cairo",   city: "Cairo",          tz: "Africa/Cairo",        flag: "🇪🇬" },
  { id: "lagos",   city: "Lagos",          tz: "Africa/Lagos",        flag: "🇳🇬" },
  { id: "jo",      city: "Johannesburg",   tz: "Africa/Johannesburg", flag: "🇿🇦" },
  { id: "saopaulo",city: "São Paulo",      tz: "America/Sao_Paulo",   flag: "🇧🇷" },
  { id: "mexico",  city: "Mexico City",    tz: "America/Mexico_City", flag: "🇲🇽" },
];

const DEFAULT_IDS = ["nyc", "london", "dubai", "karachi", "tokyo"];

function getTimeInTz(tz: string) {
  try {
    const now = new Date();
    const str = now.toLocaleTimeString("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    const dateStr = now.toLocaleDateString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" });
    const parts = str.split(":");
    return { h: parts[0] || "00", m: parts[1] || "00", s: parts[2] || "00", date: dateStr };
  } catch {
    return { h: "00", m: "00", s: "00", date: "" };
  }
}

function isDaytime(tz: string) {
  try {
    const h = parseInt(new Date().toLocaleTimeString("en-US", { timeZone: tz, hour: "2-digit", hour12: false }));
    return h >= 6 && h < 20;
  } catch { return true; }
}

export default function WorldClockScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [clocks, setClocks] = useState<ClockZone[]>([]);
  const [now, setNow] = useState(new Date());
  const [search, setSearch] = useState("");
  const [addModal, setAddModal] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY).then((v) => {
      if (v) {
        try {
          const ids: string[] = JSON.parse(v);
          setClocks(ALL_ZONES.filter((z) => ids.includes(z.id)));
        } catch {}
      } else {
        setClocks(ALL_ZONES.filter((z) => DEFAULT_IDS.includes(z.id)));
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORE_KEY, JSON.stringify(clocks.map((c) => c.id)));
  }, [clocks, loaded]);

  const addClock = (z: ClockZone) => {
    if (clocks.find((c) => c.id === z.id)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setClocks((prev) => [...prev, z]);
    setAddModal(false);
  };

  const removeClock = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setClocks((prev) => prev.filter((c) => c.id !== id));
  };

  const localTime = getTimeInTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const filtered = ALL_ZONES.filter(
    (z) => !clocks.find((c) => c.id === z.id) &&
      (z.city.toLowerCase().includes(search.toLowerCase()) || z.flag.includes(search))
  );

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <ToolHeader title="World Clock" subtitle="Track time across cities" accentColor={ACCENT} />

      <View style={s.localCard}>
        <View style={s.localLeft}>
          <Text style={s.localLabel}>Your Local Time</Text>
          <Text style={s.localDate}>{localTime.date}</Text>
        </View>
        <Text style={s.localTime}>{localTime.h}:{localTime.m}</Text>
      </View>

      <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
        {clocks.map((z) => {
          const t = getTimeInTz(z.tz);
          const day = isDaytime(z.tz);
          return (
            <View key={z.id} style={[s.clockCard, !day && s.clockCardNight]}>
              <View style={[s.clockIcon, { backgroundColor: day ? "#FEF3C7" : "#1E293B" }]}>
                <Text style={s.flagText}>{z.flag}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.cityName, !day && { color: Colors.white }]}>{z.city}</Text>
                <View style={s.dayRow}>
                  <Ionicons name={day ? "sunny-outline" : "moon-outline"} size={11} color={day ? "#D97706" : "#94A3B8"} />
                  <Text style={[s.clockDate, !day && { color: "#94A3B8" }]}>{t.date}</Text>
                </View>
              </View>
              <Text style={[s.clockTime, !day && { color: Colors.white }]}>{t.h}:{t.m}</Text>
              <Text style={[s.clockSec, !day && { color: "#64748B" }]}>{t.s}</Text>
              <Pressable onPress={() => removeClock(z.id)} hitSlop={10} style={s.removeBtn}>
                <Ionicons name="close" size={16} color={day ? Colors.textMuted : "#64748B"} />
              </Pressable>
            </View>
          );
        })}

        {clocks.length === 0 && (
          <View style={s.empty}>
            <Text style={{ fontSize: 52 }}>🌍</Text>
            <Text style={s.emptyTitle}>No clocks added</Text>
            <Text style={s.emptyText}>Tap + to track time in different cities around the world.</Text>
          </View>
        )}
      </ScrollView>

      <Pressable onPress={() => setAddModal(true)} style={s.fab}>
        <Ionicons name="add" size={26} color={Colors.white} />
      </Pressable>

      <Modal visible={addModal} animationType="slide" onRequestClose={() => setAddModal(false)}>
        <View style={[s.modalContainer, { paddingTop: topPad }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Add City</Text>
            <Pressable onPress={() => setAddModal(false)} hitSlop={10}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
          </View>
          <View style={s.searchBox}>
            <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search city…"
              placeholderTextColor={Colors.textMuted}
              autoFocus
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(z) => z.id}
            renderItem={({ item: z }) => {
              const t = getTimeInTz(z.tz);
              return (
                <Pressable onPress={() => addClock(z)} style={s.cityRow}>
                  <Text style={s.cityFlag}>{z.flag}</Text>
                  <Text style={s.cityRowName}>{z.city}</Text>
                  <Text style={s.cityRowTime}>{t.h}:{t.m}</Text>
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: Colors.separator }} />}
          />
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  localCard: { flexDirection: "row", alignItems: "center", margin: 16, padding: 16, backgroundColor: ACCENT, borderRadius: 18, justifyContent: "space-between" },
  localLeft: { gap: 2 },
  localLabel: { fontFamily: "Poppins_400Regular", fontSize: 11, color: "rgba(255,255,255,0.75)" },
  localDate: { fontFamily: "Poppins_500Medium", fontSize: 12, color: Colors.white },
  localTime: { fontFamily: "Poppins_700Bold", fontSize: 32, color: Colors.white, letterSpacing: -1 },
  list: { paddingHorizontal: 16, gap: 10, paddingBottom: 100 },
  clockCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.cardBorder },
  clockCardNight: { backgroundColor: "#0F172A", borderColor: "#1E293B" },
  clockIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  flagText: { fontSize: 22 },
  cityName: { fontFamily: "Poppins_600SemiBold", fontSize: 15, color: Colors.text },
  dayRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  clockDate: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textSecondary },
  clockTime: { fontFamily: "Poppins_700Bold", fontSize: 26, color: Colors.text, letterSpacing: -0.5 },
  clockSec: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.textMuted, width: 18, marginTop: 8 },
  removeBtn: { padding: 4 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { fontFamily: "Poppins_700Bold", fontSize: 20, color: Colors.text },
  emptyText: { fontFamily: "Poppins_400Regular", fontSize: 13, color: Colors.textSecondary, textAlign: "center", maxWidth: 260 },
  fab: { position: "absolute", bottom: 32, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: ACCENT, justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  modalTitle: { fontFamily: "Poppins_700Bold", fontSize: 20, color: Colors.text },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, margin: 16, backgroundColor: Colors.separator, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.text },
  cityRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  cityFlag: { fontSize: 24, width: 36, textAlign: "center" },
  cityRowName: { flex: 1, fontFamily: "Poppins_500Medium", fontSize: 15, color: Colors.text },
  cityRowTime: { fontFamily: "Poppins_600SemiBold", fontSize: 15, color: ACCENT },
});
