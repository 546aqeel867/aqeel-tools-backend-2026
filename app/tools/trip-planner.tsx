import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Modal, Platform, Alert, Animated, KeyboardAvoidingView,
  ActivityIndicator, FlatList,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";
import { aiChat, AiKeyMissingError, AiChatMessage } from "@/lib/ai";

const ACCENT = "#059669";
const ACCENT_LIGHT = "#ECFDF5";
const STORAGE_KEY = "travel_planner_v2";

function uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

// ── Types ─────────────────────────────────────────────────────────────────────
interface Activity {
  id: string; time: string; name: string; location: string;
  emoji: string; done: boolean; lat?: number; lng?: number;
}
interface Day { id: string; date: string; label: string; activities: Activity[]; }
interface CheckItem { id: string; label: string; checked: boolean; category: string; }
interface TripData {
  tripName: string; destination: string; days: Day[];
  checklist: CheckItem[]; notes: string;
}

const DEFAULT_CHECKLIST: CheckItem[] = [
  { id: "1", label: "Passport / ID", checked: false, category: "Documents" },
  { id: "2", label: "Travel insurance", checked: false, category: "Documents" },
  { id: "3", label: "Booking confirmations", checked: false, category: "Documents" },
  { id: "4", label: "Local currency / card", checked: false, category: "Money" },
  { id: "5", label: "Credit/debit cards", checked: false, category: "Money" },
  { id: "6", label: "T-shirts (3–5)", checked: false, category: "Clothes" },
  { id: "7", label: "Comfortable shoes", checked: false, category: "Clothes" },
  { id: "8", label: "Rain jacket", checked: false, category: "Clothes" },
  { id: "9", label: "Phone charger", checked: false, category: "Electronics" },
  { id: "10", label: "Power bank", checked: false, category: "Electronics" },
  { id: "11", label: "Earphones", checked: false, category: "Electronics" },
  { id: "12", label: "Sunscreen", checked: false, category: "Health" },
  { id: "13", label: "First-aid kit", checked: false, category: "Health" },
  { id: "14", label: "Medications", checked: false, category: "Health" },
  { id: "15", label: "Water bottle", checked: false, category: "Misc" },
  { id: "16", label: "Snacks for travel", checked: false, category: "Misc" },
];

const CATEGORY_ICONS: Record<string, string> = {
  Documents: "document-text-outline", Money: "card-outline",
  Clothes: "shirt-outline", Electronics: "phone-portrait-outline",
  Health: "medical-outline", Misc: "bag-outline",
};
const CATEGORY_COLORS: Record<string, string> = {
  Documents: "#2563EB", Money: "#059669", Clothes: "#7C3AED",
  Electronics: "#0891B2", Health: "#DB2777", Misc: "#D97706",
};

const ACTIVITY_EMOJIS = ["🗺️","🍽️","🏛️","🎭","🏖️","🛍️","☕","🌄","🚌","🏨","🎯","🎪","🚶","🚣","🎢","🌮","🍕","🍜","🎵","⛪","🏰","🌿","🦁","🌅"];

const DAY_COLORS = ["#059669","#2563EB","#F59E0B","#7C3AED","#DC2626","#0891B2","#DB2777","#16A34A"];

async function geocodeLocation(location: string, context = ""): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = encodeURIComponent(context ? `${location}, ${context}` : location);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
      headers: { "User-Agent": "TripPlannerApp/1.0" },
    });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch {}
  return null;
}

// ── Leaflet Map HTML ───────────────────────────────────────────────────────────
type MapMarker = { name: string; lat: number; lng: number; emoji: string; dayIndex: number; time?: string };

function buildMapHtml(markers: MapMarker[], destination: string, destCoords?: { lat: number; lng: number } | null) {
  const center = markers.length > 0
    ? `[${markers[0].lat}, ${markers[0].lng}]`
    : destCoords ? `[${destCoords.lat}, ${destCoords.lng}]` : "[20, 0]";
  const zoom = markers.length > 0 ? 13 : destCoords ? 12 : 2;

  const markerJs = markers.map((m) => {
    const col = DAY_COLORS[m.dayIndex % DAY_COLORS.length];
    return `(function(){
  var ic=L.divIcon({html:'<div style="background:${col};width:36px;height:36px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:15px;line-height:36px;text-align:center">${m.emoji}</div>',className:'',iconSize:[36,36],iconAnchor:[18,18],popupAnchor:[0,-18]});
  L.marker([${m.lat},${m.lng}],{icon:ic}).addTo(map).bindPopup('<div style="font-family:-apple-system,sans-serif;min-width:120px"><div style="font-size:11px;color:#6B7280;margin-bottom:2px">Day ${m.dayIndex + 1}${m.time ? " · " + m.time : ""}</div><b style="font-size:13px">${m.name}</b></div>');
})();`;
  }).join("\n");

  // Group markers by day for polylines
  const dayGroups: Record<number, MapMarker[]> = {};
  markers.forEach(m => { (dayGroups[m.dayIndex] = dayGroups[m.dayIndex] || []).push(m); });
  const polylineJs = Object.entries(dayGroups).map(([di, pts]) => {
    if (pts.length < 2) return "";
    const col = DAY_COLORS[parseInt(di) % DAY_COLORS.length];
    const coords = pts.map(p => `[${p.lat},${p.lng}]`).join(",");
    return `L.polyline([${coords}],{color:'${col}',weight:3,opacity:0.55,dashArray:'8,5'}).addTo(map);`;
  }).join("\n");

  const destMarkerJs = destCoords && markers.length === 0
    ? `L.circleMarker([${destCoords.lat},${destCoords.lng}],{radius:18,color:'#2563EB',fillColor:'#DBEAFE',fillOpacity:0.85,weight:3}).addTo(map).bindPopup('<b style="font-family:-apple-system,sans-serif">📍 ${destination}</b>').openPopup();`
    : "";

  const fitBoundsJs = markers.length > 1
    ? `map.fitBounds(L.featureGroup([${markers.map(m=>`L.marker([${m.lat},${m.lng}])`).join(',')}]).getBounds().pad(0.25));`
    : "";

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>*{margin:0;padding:0;}#map{height:100vh;width:100vw;}
.leaflet-popup-content-wrapper{border-radius:12px!important;}
</style></head><body>
<div id="map"></div>
<script>
var map=L.map('map',{zoomControl:true}).setView(${center},${zoom});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);
${destMarkerJs}
${polylineJs}
${markerJs}
${fitBoundsJs}
</script></body></html>`;
}

// ── Tab Bar ────────────────────────────────────────────────────────────────────
type Tab = "itinerary" | "map" | "checklist" | "notes";
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "itinerary", label: "Itinerary", icon: "calendar" },
  { id: "map",       label: "Map",       icon: "map" },
  { id: "checklist", label: "Packing",   icon: "checkbox" },
  { id: "notes",     label: "Notes",     icon: "document-text" },
];

function InnerTabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <View style={ts.tabBar}>
      {TABS.map((t) => {
        const on = active === t.id;
        return (
          <Pressable key={t.id} onPress={() => { Haptics.selectionAsync(); onChange(t.id); }} style={[ts.tabItem, on && ts.tabItemOn]}>
            <Ionicons name={`${t.icon}${on ? "" : "-outline"}` as any} size={18} color={on ? ACCENT : Colors.textMuted} />
            <Text style={[ts.tabLabel, on && ts.tabLabelOn]}>{t.label}</Text>
            {on && <View style={ts.tabDot} />}
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Itinerary Tab ─────────────────────────────────────────────────────────────
function ItineraryTab({ days, onDaysChange, destination, apiKeys, hasAiKey }: {
  days: Day[]; onDaysChange: (d: Day[]) => void;
  destination: string; apiKeys: any; hasAiKey: boolean;
}) {
  const [addDayModalOpen, setAddDayModalOpen] = useState(false);
  const [actModal, setActModal] = useState<{ dayId: string; act?: Activity } | null>(null);
  const [aiPanel, setAiPanel] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState("");
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const addDay = () => {
    const dayNum = days.length + 1;
    const d = new Date();
    d.setDate(d.getDate() + days.length);
    const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const newDay: Day = { id: uid(), date: d.toISOString().split("T")[0], label, activities: [] };
    onDaysChange([...days, newDay]);
    setExpandedDays((s) => new Set([...s, newDay.id]));
  };

  const deleteDay = (dayId: string) => {
    Alert.alert("Remove Day", "Delete this day and all its activities?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDaysChange(days.filter((d) => d.id !== dayId)) },
    ]);
  };

  const saveActivity = (dayId: string, act: Activity) => {
    onDaysChange(days.map((d) => {
      if (d.id !== dayId) return d;
      const exists = d.activities.find((a) => a.id === act.id);
      return { ...d, activities: exists ? d.activities.map((a) => a.id === act.id ? act : a) : [...d.activities, act].sort((a, b) => a.time.localeCompare(b.time)) };
    }));
    setActModal(null);
  };

  const toggleDone = (dayId: string, actId: string) => {
    onDaysChange(days.map((d) => d.id !== dayId ? d : {
      ...d, activities: d.activities.map((a) => a.id === actId ? { ...a, done: !a.done } : a),
    }));
  };

  const deleteActivity = (dayId: string, actId: string) => {
    onDaysChange(days.map((d) => d.id !== dayId ? d : { ...d, activities: d.activities.filter((a) => a.id !== actId) }));
  };

  const generateWithAI = async () => {
    if (!aiInput.trim() || !hasAiKey) return;
    setAiLoading(true);
    setAiStatus("Planning your trip…");
    try {
      const numDays = days.length || 3;
      const dest = destination || aiInput;
      const prompt = `Create a DETAILED ${numDays}-day travel itinerary for: ${aiInput}${destination ? ` in ${destination}` : ""}.

RULES:
- Use REAL, famous, specific place names (not generic like "local restaurant")
- Pick the BEST-RATED landmarks and restaurants for each city
- OPTIMAL timing: mornings for outdoor/active, afternoons for culture/indoors, evenings for dining/nightlife
- Max 5 activities per day, with realistic travel time between them
- Mix types: sightseeing 🏛️, food 🍽️, nature 🌿, culture 🎭, shopping 🛍️

Format EXACTLY like this (do not deviate):
DAY 1 - Monday, Jan 6
09:00 | 🏛️ | Eiffel Tower | Champ de Mars, Paris
12:30 | 🍽️ | Café de Flore | 172 Bd St-Germain, Paris
15:00 | 🗺️ | Louvre Museum | Rue de Rivoli, Paris
19:30 | 🍷 | Le Grand Véfour | 17 Rue de Beaujolais, Paris

DAY 2 - Tuesday, Jan 7
...

Use REAL street addresses or well-known district names as the location.`;

      const history: AiChatMessage[] = [{ role: "user", content: prompt }];
      const reply = await aiChat(apiKeys, history, "You are a world-class travel planner with expert knowledge of the best restaurants, landmarks, hidden gems, and optimal daily schedules for any destination. Always use real, specific place names that can be found on Google Maps.");

      const parsedDays = parseAIItinerary(reply || "");
      if (parsedDays.length === 0) {
        Alert.alert("Tip", "AI responded but format wasn't recognised. Try: '3 days in Tokyo'");
        return;
      }

      // Auto-geocode all activity locations
      const totalLocs = parsedDays.reduce((s, d) => s + d.activities.filter(a => a.location).length, 0);
      let geocoded = 0;
      for (const day of parsedDays) {
        for (const act of day.activities) {
          if (act.location) {
            setAiStatus(`Pinning on map… ${++geocoded}/${totalLocs}`);
            const coords = await geocodeLocation(act.location, dest);
            if (coords) { act.lat = coords.lat; act.lng = coords.lng; }
            await new Promise(r => setTimeout(r, 320));
          }
        }
      }

      onDaysChange(parsedDays);
      parsedDays.forEach((d) => setExpandedDays((s) => new Set([...s, d.id])));
      setAiPanel(false);
      setAiInput("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "AI couldn't generate itinerary right now.");
    } finally {
      setAiLoading(false);
      setAiStatus("");
    }
  };

  const totalActivities = days.reduce((s, d) => s + d.activities.length, 0);
  const doneActivities = days.reduce((s, d) => s + d.activities.filter((a) => a.done).length, 0);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={ts.tabContent} showsVerticalScrollIndicator={false}>
        {days.length === 0 ? (
          <View style={ts.empty}>
            <Text style={ts.emptyEmoji}>✈️</Text>
            <Text style={ts.emptyTitle}>No days yet</Text>
            <Text style={ts.emptyText}>Add days to your itinerary or let AI build one for you!</Text>
          </View>
        ) : (
          <>
            <View style={ts.progressCard}>
              <Text style={ts.progressLabel}>{doneActivities}/{totalActivities} activities completed</Text>
              <View style={ts.progressBar}>
                <View style={[ts.progressFill, { width: totalActivities > 0 ? `${(doneActivities / totalActivities) * 100}%` : "0%" as any }]} />
              </View>
            </View>
            {days.map((day, idx) => {
              const expanded = expandedDays.has(day.id);
              return (
                <View key={day.id} style={ts.dayCard}>
                  <Pressable onPress={() => setExpandedDays((s) => { const n = new Set(s); expanded ? n.delete(day.id) : n.add(day.id); return n; })} style={ts.dayHeader}>
                    <View style={ts.dayBadge}><Text style={ts.dayBadgeText}>D{idx + 1}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={ts.dayTitle}>Day {idx + 1}</Text>
                      <Text style={ts.dayDate}>{day.label} · {day.activities.length} activities</Text>
                    </View>
                    <Pressable onPress={() => deleteDay(day.id)} hitSlop={8} style={ts.dayDelete}>
                      <Ionicons name="trash-outline" size={15} color={Colors.error} />
                    </Pressable>
                    <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={Colors.textMuted} />
                  </Pressable>
                  {expanded && (
                    <View style={ts.activitiesList}>
                      {day.activities.map((act) => (
                        <View key={act.id} style={ts.actRow}>
                          <Pressable onPress={() => toggleDone(day.id, act.id)} style={[ts.actCheck, act.done && ts.actCheckDone]}>
                            {act.done && <Ionicons name="checkmark" size={12} color={Colors.white} />}
                          </Pressable>
                          <Text style={ts.actTime}>{act.time}</Text>
                          <Text style={ts.actEmoji}>{act.emoji}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={[ts.actName, act.done && ts.actDoneText]}>{act.name}</Text>
                            {act.location ? <Text style={ts.actLocation}><Ionicons name="location-outline" size={10} color={Colors.textMuted} /> {act.location}</Text> : null}
                          </View>
                          <Pressable onPress={() => setActModal({ dayId: day.id, act })} hitSlop={8}>
                            <Ionicons name="pencil-outline" size={15} color={Colors.textMuted} />
                          </Pressable>
                          <Pressable onPress={() => deleteActivity(day.id, act.id)} hitSlop={8} style={{ marginLeft: 4 }}>
                            <Ionicons name="close" size={15} color={Colors.error} />
                          </Pressable>
                        </View>
                      ))}
                      <Pressable onPress={() => setActModal({ dayId: day.id })} style={ts.addActBtn}>
                        <Ionicons name="add" size={16} color={ACCENT} />
                        <Text style={ts.addActText}>Add activity</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        <Pressable onPress={addDay} style={ts.addDayBtn}>
          <Ionicons name="add-circle-outline" size={18} color={ACCENT} />
          <Text style={ts.addDayText}>Add Day</Text>
        </Pressable>
      </ScrollView>

      <View style={ts.aiBar}>
        <Pressable
          onPress={() => { if (!hasAiKey) { Alert.alert("API Key needed", "Add your AI key in Settings."); return; } setAiPanel(true); }}
          style={ts.aiBtn}
        >
          <MaterialCommunityIcons name="robot" size={16} color={Colors.white} />
          <Text style={ts.aiBtnText}>Generate with AI</Text>
        </Pressable>
      </View>

      {actModal && <ActivityModal dayId={actModal.dayId} existing={actModal.act} onSave={saveActivity} onClose={() => setActModal(null)} />}

      <Modal visible={aiPanel} animationType="slide" transparent onRequestClose={() => !aiLoading && setAiPanel(false)}>
        <Pressable style={ts.modalOverlay} onPress={() => { if (!aiLoading) setAiPanel(false); }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <Pressable style={ts.aiSheet} onPress={(e) => e.stopPropagation()}>
              <Text style={ts.aiSheetTitle}>✈️ AI Trip Planner</Text>
              <Text style={ts.aiSheetSub}>Describe your trip — AI picks the best locations, timings & restaurants</Text>

              {/* Quick chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {["3 days in Paris", "Weekend in Tokyo", "5 days Bali beach & culture", "4 days Rome food tour", "3 days Dubai luxury"].map(chip => (
                    <Pressable key={chip} onPress={() => setAiInput(chip)} style={[ts.chipBtn, aiInput === chip && ts.chipBtnOn]}>
                      <Text style={[ts.chipText, aiInput === chip && ts.chipTextOn]}>{chip}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              <TextInput
                style={ts.aiInput}
                value={aiInput}
                onChangeText={setAiInput}
                placeholder={`e.g. "4 days in Kyoto, temples + food + nature"`}
                placeholderTextColor={Colors.textMuted}
                multiline
                autoFocus
                editable={!aiLoading}
              />

              {aiLoading && aiStatus ? (
                <View style={ts.aiStatusRow}>
                  <ActivityIndicator color={ACCENT} size="small" />
                  <Text style={ts.aiStatusText}>{aiStatus}</Text>
                </View>
              ) : null}

              <Pressable onPress={generateWithAI} disabled={aiLoading || !aiInput.trim()} style={[ts.aiGenerateBtn, (aiLoading || !aiInput.trim()) && { opacity: 0.5 }]}>
                {aiLoading
                  ? <ActivityIndicator color={Colors.white} size="small" />
                  : <Text style={ts.aiGenerateBtnText}>Generate Best Itinerary</Text>}
              </Pressable>
              {!aiLoading && <Text style={ts.aiHint}>AI will auto-pin all locations on your map</Text>}
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── Activity Modal ─────────────────────────────────────────────────────────────
function ActivityModal({ dayId, existing, onSave, onClose }: {
  dayId: string; existing?: Activity; onSave: (dayId: string, act: Activity) => void; onClose: () => void;
}) {
  const [time, setTime] = useState(existing?.time || "09:00");
  const [name, setName] = useState(existing?.name || "");
  const [location, setLocation] = useState(existing?.location || "");
  const [emoji, setEmoji] = useState(existing?.emoji || "🗺️");
  const [lat, setLat] = useState<number | undefined>(existing?.lat);
  const [lng, setLng] = useState<number | undefined>(existing?.lng);
  const [locating, setLocating] = useState(false);

  const autoLocate = async () => {
    if (!location.trim()) { Alert.alert("Enter a location name first"); return; }
    setLocating(true);
    const coords = await geocodeLocation(location.trim());
    setLocating(false);
    if (coords) {
      setLat(coords.lat);
      setLng(coords.lng);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert("Not found", "Couldn't find this location. Try a more specific address.");
    }
  };

  const save = () => {
    if (!name.trim()) { Alert.alert("Name required"); return; }
    onSave(dayId, { id: existing?.id || uid(), time, name: name.trim(), location: location.trim(), emoji, done: existing?.done || false, lat, lng });
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={ts.modalOverlay} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={ts.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={ts.sheetTitle}>{existing ? "Edit Activity" : "Add Activity"}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {ACTIVITY_EMOJIS.map((e) => (
                  <Pressable key={e} onPress={() => setEmoji(e)} style={[ts.emojiBtn, emoji === e && ts.emojiBtnOn]}>
                    <Text style={{ fontSize: 22 }}>{e}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <Text style={ts.fieldLabel}>Time</Text>
            <TextInput style={ts.fieldInput} value={time} onChangeText={setTime} placeholder="09:00" keyboardType="numbers-and-punctuation" />
            <Text style={ts.fieldLabel}>Activity name *</Text>
            <TextInput style={ts.fieldInput} value={name} onChangeText={setName} placeholder="Visit the Eiffel Tower" autoFocus />
            <Text style={ts.fieldLabel}>Location</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput style={[ts.fieldInput, { flex: 1 }]} value={location} onChangeText={(v) => { setLocation(v); setLat(undefined); setLng(undefined); }} placeholder="Champ de Mars, Paris" />
              <Pressable onPress={autoLocate} disabled={locating || !location.trim()} style={[ts.locateBtn, (!location.trim()) && { opacity: 0.4 }]}>
                {locating ? <ActivityIndicator size="small" color={ACCENT} /> : <Ionicons name="location" size={18} color={lat ? ACCENT : Colors.textMuted} />}
              </Pressable>
            </View>
            {lat && lng ? (
              <View style={ts.coordsRow}>
                <Ionicons name="checkmark-circle" size={13} color={ACCENT} />
                <Text style={ts.coordsText}>Pinned on map · {lat.toFixed(4)}, {lng.toFixed(4)}</Text>
              </View>
            ) : (
              <Text style={ts.coordsHint}>Tap 📍 to auto-pin this location on the map</Text>
            )}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
              <Pressable onPress={onClose} style={[ts.sheetBtn, ts.sheetBtnCancel]}><Text style={ts.sheetBtnCancelText}>Cancel</Text></Pressable>
              <Pressable onPress={save} style={[ts.sheetBtn, ts.sheetBtnSave]}><Text style={ts.sheetBtnSaveText}>Save</Text></Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// ── Map Tab ───────────────────────────────────────────────────────────────────
function MapTab({ days, destination }: { days: Day[]; destination: string }) {
  const markers: MapMarker[] = days.flatMap((d, dayIdx) =>
    d.activities.filter((a) => a.lat && a.lng).map((a) => ({
      name: a.name, lat: a.lat!, lng: a.lng!, emoji: a.emoji, dayIndex: dayIdx, time: a.time,
    }))
  );

  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (!destination) return;
    setGeocoding(true);
    geocodeLocation(destination).then((c) => {
      setDestCoords(c);
      setGeocoding(false);
    });
  }, [destination]);

  const mapHtml = buildMapHtml(markers, destination, destCoords);

  // Day legend
  const uniqueDays = days.map((d, i) => ({ label: d.label, color: DAY_COLORS[i % DAY_COLORS.length], count: d.activities.filter(a => a.lat && a.lng).length }));

  if (Platform.OS === "web") {
    return (
      <View style={ts.mapWebFallback}>
        <Text style={{ fontSize: 64 }}>🗺️</Text>
        <Text style={ts.emptyTitle}>Map View</Text>
        <Text style={ts.emptyText}>Open this app on your phone via Expo Go to see the interactive map with all your pinned locations.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {geocoding && markers.length === 0 && (
        <View style={ts.mapGeocodeOverlay}>
          <ActivityIndicator color={ACCENT} size="small" />
          <Text style={ts.mapGeocodeText}>Locating {destination}…</Text>
        </View>
      )}
      <WebView
        source={{ html: mapHtml }}
        style={{ flex: 1 }}
        javaScriptEnabled
        domStorageEnabled
      />
      {/* Day legend */}
      {uniqueDays.length > 0 && (
        <View style={ts.mapLegend}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {uniqueDays.map((d, i) => (
                <View key={i} style={ts.mapLegendItem}>
                  <View style={[ts.mapLegendDot, { backgroundColor: d.color }]} />
                  <Text style={ts.mapLegendText}>Day {i + 1} ({d.count} pinned)</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}
      {markers.length === 0 && !geocoding && (
        <View style={ts.mapBanner}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
          <Text style={ts.mapBannerText}>
            {destination ? `Showing ${destination} — generate an AI itinerary to auto-pin all locations.` : "Set a destination and generate an AI itinerary to see activities on the map."}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Checklist Tab ─────────────────────────────────────────────────────────────
function ChecklistTab({ items, onItemsChange }: { items: CheckItem[]; onItemsChange: (items: CheckItem[]) => void }) {
  const [addModal, setAddModal] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newCat, setNewCat] = useState("Misc");

  const categories = Array.from(new Set(items.map((i) => i.category)));
  const checked = items.filter((i) => i.checked).length;
  const progress = items.length > 0 ? checked / items.length : 0;

  const toggle = (id: string) => {
    Haptics.selectionAsync();
    onItemsChange(items.map((i) => i.id === id ? { ...i, checked: !i.checked } : i));
  };

  const addItem = () => {
    if (!newLabel.trim()) return;
    onItemsChange([...items, { id: uid(), label: newLabel.trim(), checked: false, category: newCat }]);
    setNewLabel("");
    setAddModal(false);
  };

  const deleteItem = (id: string) => {
    onItemsChange(items.filter((i) => i.id !== id));
  };

  const resetAll = () => {
    Alert.alert("Reset All", "Uncheck all items?", [
      { text: "Cancel", style: "cancel" },
      { text: "Reset", onPress: () => onItemsChange(items.map((i) => ({ ...i, checked: false }))) },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={ts.tabContent} showsVerticalScrollIndicator={false}>
      <View style={ts.checkProgressCard}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text style={ts.progressLabel}>{checked}/{items.length} packed</Text>
          {checked > 0 && <Pressable onPress={resetAll}><Text style={ts.resetText}>Reset</Text></Pressable>}
        </View>
        <View style={ts.progressBar}>
          <Animated.View style={[ts.progressFill, { width: `${Math.round(progress * 100)}%` as any, backgroundColor: progress === 1 ? Colors.success : ACCENT }]} />
        </View>
        {progress === 1 && <Text style={ts.packingDone}>All packed! ✈️ Ready to go!</Text>}
      </View>

      {categories.map((cat) => (
        <View key={cat} style={ts.catSection}>
          <View style={ts.catHeader}>
            <View style={[ts.catIconBox, { backgroundColor: (CATEGORY_COLORS[cat] || "#7C3AED") + "20" }]}>
              <Ionicons name={(CATEGORY_ICONS[cat] || "bag-outline") as any} size={16} color={CATEGORY_COLORS[cat] || "#7C3AED"} />
            </View>
            <Text style={[ts.catTitle, { color: CATEGORY_COLORS[cat] || "#7C3AED" }]}>{cat}</Text>
            <Text style={ts.catCount}>{items.filter((i) => i.category === cat && i.checked).length}/{items.filter((i) => i.category === cat).length}</Text>
          </View>
          {items.filter((i) => i.category === cat).map((item) => (
            <Pressable key={item.id} onPress={() => toggle(item.id)} style={ts.checkRow}>
              <View style={[ts.checkBox, item.checked && { backgroundColor: ACCENT, borderColor: ACCENT }]}>
                {item.checked && <Ionicons name="checkmark" size={13} color={Colors.white} />}
              </View>
              <Text style={[ts.checkLabel, item.checked && ts.checkLabelDone]}>{item.label}</Text>
              <Pressable onPress={() => deleteItem(item.id)} hitSlop={8}>
                <Ionicons name="close" size={15} color={Colors.textMuted} />
              </Pressable>
            </Pressable>
          ))}
        </View>
      ))}

      <Pressable onPress={() => setAddModal(true)} style={ts.addDayBtn}>
        <Ionicons name="add-circle-outline" size={18} color={ACCENT} />
        <Text style={ts.addDayText}>Add Item</Text>
      </Pressable>

      <Modal visible={addModal} animationType="slide" transparent onRequestClose={() => setAddModal(false)}>
        <Pressable style={ts.modalOverlay} onPress={() => setAddModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <Pressable style={ts.sheet} onPress={(e) => e.stopPropagation()}>
              <Text style={ts.sheetTitle}>Add Packing Item</Text>
              <Text style={ts.fieldLabel}>Item name</Text>
              <TextInput style={ts.fieldInput} value={newLabel} onChangeText={setNewLabel} placeholder="e.g. Sunglasses" autoFocus />
              <Text style={ts.fieldLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 8, paddingVertical: 4 }}>
                  {Object.keys(CATEGORY_COLORS).map((c) => (
                    <Pressable key={c} onPress={() => setNewCat(c)} style={[ts.catChip, newCat === c && { backgroundColor: ACCENT }]}>
                      <Text style={[ts.catChipText, newCat === c && { color: Colors.white }]}>{c}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                <Pressable onPress={() => setAddModal(false)} style={[ts.sheetBtn, ts.sheetBtnCancel]}><Text style={ts.sheetBtnCancelText}>Cancel</Text></Pressable>
                <Pressable onPress={addItem} style={[ts.sheetBtn, ts.sheetBtnSave]}><Text style={ts.sheetBtnSaveText}>Add</Text></Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

// ── Notes Tab ─────────────────────────────────────────────────────────────────
function NotesTab({ notes, onNotesChange }: { notes: string; onNotesChange: (n: string) => void }) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        <View style={ts.notesHeader}>
          <Ionicons name="document-text-outline" size={18} color={ACCENT} />
          <Text style={ts.notesHeaderText}>Trip Notes</Text>
          <Text style={ts.charCount}>{notes.length} chars</Text>
        </View>
        <TextInput
          style={ts.notesInput}
          value={notes}
          onChangeText={onNotesChange}
          multiline
          textAlignVertical="top"
          placeholder={"Jot anything down…\n\n• Hotel check-in: 3pm\n• Airport terminal: T2\n• Emergency contact: +1 555 0100\n• Travel insurance policy: XYZ-12345\n• Favourite restaurant: La Bella Napoli"}
          placeholderTextColor={Colors.textMuted}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Parse AI Itinerary ────────────────────────────────────────────────────────
function parseAIItinerary(text: string): Day[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const days: Day[] = [];
  let current: Day | null = null;

  for (const line of lines) {
    const dayMatch = line.match(/^DAY\s+(\d+)\s*[-–]?\s*(.*)$/i);
    if (dayMatch) {
      if (current) days.push(current);
      const d = new Date();
      d.setDate(d.getDate() + (days.length));
      const label = dayMatch[2]?.trim() || d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      current = { id: uid(), date: d.toISOString().split("T")[0], label, activities: [] };
      continue;
    }
    if (!current) continue;
    const actMatch = line.match(/^(\d{1,2}:\d{2})\s*[|\-]\s*(\S+)\s*[|\-]\s*(.+?)\s*[|\-]\s*(.*)$/);
    if (actMatch) {
      const [, time, emoji, name, location] = actMatch;
      current.activities.push({ id: uid(), time, emoji, name: name.trim(), location: location.trim(), done: false });
    } else {
      const simpleMatch = line.match(/^(\d{1,2}:\d{2})\s*[-:]\s*(.+)$/);
      if (simpleMatch) {
        const [, time, name] = simpleMatch;
        current.activities.push({ id: uid(), time, emoji: "🗺️", name: name.trim(), location: "", done: false });
      }
    }
  }
  if (current) days.push(current);
  return days;
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function TravelPlannerScreen() {
  const insets = useSafeAreaInsets();
  const { apiKeys, hasAiKey } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [tab, setTab] = useState<Tab>("itinerary");
  const [trip, setTrip] = useState<TripData>({
    tripName: "My Trip", destination: "", days: [], checklist: DEFAULT_CHECKLIST, notes: "",
  });
  const [setupModal, setSetupModal] = useState(false);
  const [tmpName, setTmpName] = useState("");
  const [tmpDest, setTmpDest] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v) { try { setTrip(JSON.parse(v)); } catch {} }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trip));
  }, [trip, loaded]);

  const updateTrip = useCallback((patch: Partial<TripData>) => setTrip((t) => ({ ...t, ...patch })), []);

  if (!loaded) {
    return (
      <View style={[ts.container, { paddingTop: topPad, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  return (
    <View style={[ts.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={ts.header}>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} style={ts.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </Pressable>
        <Pressable onPress={() => { setTmpName(trip.tripName); setTmpDest(trip.destination); setSetupModal(true); }} style={{ flex: 1 }}>
          <Text style={ts.headerTitle} numberOfLines={1}>{trip.tripName}</Text>
          <Text style={ts.headerSub} numberOfLines={1}>
            {trip.destination || "Tap to set destination"} · {trip.days.length} day{trip.days.length !== 1 ? "s" : ""}
          </Text>
        </Pressable>
        <View style={[ts.accentDot, { backgroundColor: ACCENT }]}>
          <Text style={{ fontSize: 16 }}>✈️</Text>
        </View>
      </View>

      {/* Inner Tab Bar */}
      <InnerTabBar active={tab} onChange={setTab} />

      {/* Tab Content */}
      <View style={{ flex: 1 }}>
        {tab === "itinerary" && (
          <ItineraryTab
            days={trip.days}
            onDaysChange={(days) => updateTrip({ days })}
            destination={trip.destination}
            apiKeys={apiKeys}
            hasAiKey={hasAiKey}
          />
        )}
        {tab === "map" && <MapTab days={trip.days} destination={trip.destination} />}
        {tab === "checklist" && (
          <ChecklistTab
            items={trip.checklist}
            onItemsChange={(checklist) => updateTrip({ checklist })}
          />
        )}
        {tab === "notes" && (
          <NotesTab notes={trip.notes} onNotesChange={(notes) => updateTrip({ notes })} />
        )}
      </View>

      {/* Trip Setup Modal */}
      <Modal visible={setupModal} animationType="slide" transparent onRequestClose={() => setSetupModal(false)}>
        <Pressable style={ts.modalOverlay} onPress={() => setSetupModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <Pressable style={ts.sheet} onPress={(e) => e.stopPropagation()}>
              <Text style={ts.sheetTitle}>Trip Settings</Text>
              <Text style={ts.fieldLabel}>Trip name</Text>
              <TextInput style={ts.fieldInput} value={tmpName} onChangeText={setTmpName} placeholder="Summer Europe Trip" autoFocus />
              <Text style={ts.fieldLabel}>Destination</Text>
              <TextInput style={ts.fieldInput} value={tmpDest} onChangeText={setTmpDest} placeholder="Paris, France" />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                <Pressable onPress={() => setSetupModal(false)} style={[ts.sheetBtn, ts.sheetBtnCancel]}><Text style={ts.sheetBtnCancelText}>Cancel</Text></Pressable>
                <Pressable
                  onPress={() => { updateTrip({ tripName: tmpName || "My Trip", destination: tmpDest }); setSetupModal(false); }}
                  style={[ts.sheetBtn, ts.sheetBtnSave]}
                ><Text style={ts.sheetBtnSaveText}>Save</Text></Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ts = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 8, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.separator, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontFamily: "Poppins_700Bold", fontSize: 18, color: Colors.text, letterSpacing: -0.2 },
  headerSub: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  accentDot: { width: 40, height: 40, borderRadius: 20, backgroundColor: ACCENT_LIGHT, justifyContent: "center", alignItems: "center" },

  tabBar: { flexDirection: "row", backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 10, gap: 3, position: "relative" },
  tabItemOn: {},
  tabLabel: { fontFamily: "Poppins_500Medium", fontSize: 10, color: Colors.textMuted },
  tabLabelOn: { color: ACCENT },
  tabDot: { position: "absolute", bottom: 0, width: 24, height: 3, backgroundColor: ACCENT, borderTopLeftRadius: 2, borderTopRightRadius: 2 },

  tabContent: { padding: 16, gap: 12, paddingBottom: 100 },

  empty: { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontFamily: "Poppins_700Bold", fontSize: 20, color: Colors.text },
  emptyText: { fontFamily: "Poppins_400Regular", fontSize: 13, color: Colors.textSecondary, textAlign: "center", maxWidth: 280, lineHeight: 20 },

  progressCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.cardBorder },
  checkProgressCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.cardBorder, marginBottom: 4 },
  progressLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: Colors.text, marginBottom: 8 },
  progressBar: { height: 8, backgroundColor: Colors.separator, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, backgroundColor: ACCENT, borderRadius: 4 },
  packingDone: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: Colors.success, textAlign: "center", marginTop: 8 },
  resetText: { fontFamily: "Poppins_500Medium", fontSize: 12, color: Colors.error },

  dayCard: { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.cardBorder, overflow: "hidden" },
  dayHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  dayBadge: { width: 32, height: 32, borderRadius: 10, backgroundColor: ACCENT_LIGHT, justifyContent: "center", alignItems: "center" },
  dayBadgeText: { fontFamily: "Poppins_700Bold", fontSize: 12, color: ACCENT },
  dayTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: Colors.text },
  dayDate: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textSecondary },
  dayDelete: { padding: 4 },

  activitiesList: { borderTopWidth: 1, borderTopColor: Colors.separator, paddingHorizontal: 14, paddingBottom: 10 },
  actRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.separator },
  actCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.cardBorder, justifyContent: "center", alignItems: "center" },
  actCheckDone: { backgroundColor: ACCENT, borderColor: ACCENT },
  actTime: { fontFamily: "Poppins_500Medium", fontSize: 11, color: Colors.textSecondary, width: 38 },
  actEmoji: { fontSize: 18, width: 24, textAlign: "center" },
  actName: { fontFamily: "Poppins_500Medium", fontSize: 13, color: Colors.text },
  actDoneText: { textDecorationLine: "line-through", color: Colors.textMuted },
  actLocation: { fontFamily: "Poppins_400Regular", fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  addActBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10 },
  addActText: { fontFamily: "Poppins_500Medium", fontSize: 13, color: ACCENT },
  addDayBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: ACCENT, borderStyle: "dashed", backgroundColor: ACCENT_LIGHT },
  addDayText: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: ACCENT },

  aiBar: { padding: 12, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.cardBorder },
  aiBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 13 },
  aiBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: Colors.white },
  aiSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 10 },
  aiSheetTitle: { fontFamily: "Poppins_700Bold", fontSize: 18, color: Colors.text },
  aiSheetSub: { fontFamily: "Poppins_400Regular", fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  aiInput: { backgroundColor: Colors.separator, borderRadius: 14, padding: 14, fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.text, minHeight: 80, textAlignVertical: "top", borderWidth: 1, borderColor: Colors.cardBorder },
  aiGenerateBtn: { backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  aiGenerateBtnText: { fontFamily: "Poppins_700Bold", fontSize: 15, color: Colors.white },

  catSection: { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.cardBorder, overflow: "hidden", marginBottom: 4 },
  catHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.separator },
  catIconBox: { width: 30, height: 30, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  catTitle: { flex: 1, fontFamily: "Poppins_600SemiBold", fontSize: 13 },
  catCount: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textMuted },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.separator },
  checkBox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.cardBorder, justifyContent: "center", alignItems: "center" },
  checkLabel: { flex: 1, fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.text },
  checkLabelDone: { textDecorationLine: "line-through", color: Colors.textMuted },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.separator },
  catChipText: { fontFamily: "Poppins_500Medium", fontSize: 12, color: Colors.textSecondary },

  notesHeader: { flexDirection: "row", alignItems: "center", gap: 8, padding: 16, paddingBottom: 0 },
  notesHeaderText: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: ACCENT, flex: 1 },
  charCount: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textMuted },
  notesInput: { flex: 1, margin: 16, fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.text, lineHeight: 24, minHeight: 400, textAlignVertical: "top" },

  mapWebFallback: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 32 },
  mapBanner: { position: "absolute", bottom: 16, left: 16, right: 16, flexDirection: "row", gap: 8, backgroundColor: Colors.primaryLight, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.primary + "40", alignItems: "center" },
  mapBannerText: { flex: 1, fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.text },
  mapGeocodeOverlay: { position: "absolute", top: 12, left: 0, right: 0, zIndex: 10, alignItems: "center" },
  mapGeocodeText: { fontFamily: "Poppins_500Medium", fontSize: 12, color: Colors.text, backgroundColor: "rgba(255,255,255,0.92)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 6, overflow: "hidden" },
  mapLegend: { position: "absolute", bottom: 16, left: 12, right: 12, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.cardBorder },
  mapLegendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  mapLegendDot: { width: 10, height: 10, borderRadius: 5 },
  mapLegendText: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.text },
  locateBtn: { width: 46, height: 46, borderRadius: 12, backgroundColor: ACCENT_LIGHT, borderWidth: 1, borderColor: ACCENT + "40", justifyContent: "center", alignItems: "center" },
  coordsRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  coordsText: { fontFamily: "Poppins_500Medium", fontSize: 11, color: ACCENT },
  coordsHint: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  chipBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.separator, borderWidth: 1, borderColor: Colors.cardBorder },
  chipBtnOn: { backgroundColor: ACCENT_LIGHT, borderColor: ACCENT },
  chipText: { fontFamily: "Poppins_500Medium", fontSize: 12, color: Colors.textSecondary },
  chipTextOn: { color: ACCENT },
  aiStatusRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: ACCENT_LIGHT, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  aiStatusText: { fontFamily: "Poppins_500Medium", fontSize: 13, color: ACCENT, flex: 1 },
  aiHint: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textMuted, textAlign: "center" },

  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 8 },
  sheetTitle: { fontFamily: "Poppins_700Bold", fontSize: 18, color: Colors.text, marginBottom: 4 },
  fieldLabel: { fontFamily: "Poppins_500Medium", fontSize: 12, color: Colors.textSecondary, marginTop: 6 },
  fieldInput: { backgroundColor: Colors.separator, borderRadius: 12, padding: 12, fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.cardBorder },
  sheetBtn: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  sheetBtnCancel: { backgroundColor: Colors.separator },
  sheetBtnCancelText: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: Colors.textSecondary },
  sheetBtnSave: { backgroundColor: ACCENT },
  sheetBtnSaveText: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: Colors.white },
  emojiBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center", backgroundColor: Colors.separator },
  emojiBtnOn: { backgroundColor: ACCENT_LIGHT, borderWidth: 2, borderColor: ACCENT },
});
