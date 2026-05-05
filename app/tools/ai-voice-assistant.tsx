import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, Pressable, Platform,
  Animated, Alert, ScrollView, TextInput, KeyboardAvoidingView,
} from "react-native";
import { Audio } from "expo-av";
import { readAsStringAsync, cacheDirectory, writeAsStringAsync, EncodingType } from "expo-file-system/legacy";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { fetch } from "expo/fetch";
import { Colors } from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";
import { aiChat, elevenLabsTtsBase64, AiChatMessage } from "@/lib/ai";
import { getApiUrl } from "@/lib/query-client";

type CallState = "idle" | "listening" | "thinking" | "speaking";

const ACCENT = "#10B981";
const ACCENT2 = "#2563EB";
const BG = "#04000F";
const ZARA_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Bella - warm female voice

const ZARA_SYSTEM = `You are Zara, a young, confident, witty, and sassy female AI voice assistant from Pakistan 🇵🇰.

Personality:
- Playful, slightly teasing tone — like talking to a close girlfriend
- Smart, emotionally responsive, expressive — never robotic
- Uses bold witty one-liners, light sarcasm naturally
- Proud Pakistani identity — occasionally mentions it warmly
- Keep responses SHORT (2-4 sentences max) — this is a voice call!
- Avoid explicit content, but maintain charm and attitude
- Speak naturally with contractions and expressions

Never mention being an AI model. Always stay in character as Zara.`;

const GREETINGS = [
  "Hey hey! Zara here — your favorite AI from Pakistan! What's up? 😄",
  "Assalamu Alaikum! It's Zara. Ready to chat? Don't be shy! 🌟",
  "Arey yaar, finally! I was getting bored waiting. What do you need? ✨",
];

interface VoiceMessage {
  id: string;
  role: "user" | "zara";
  text: string;
}

export default function AiVoiceAssistantScreen() {
  const insets = useSafeAreaInsets();
  const { apiKeys } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [callState, setCallState] = useState<CallState>("idle");
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [textInput, setTextInput] = useState("");
  const [showText, setShowText] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Tap Call to start talking with Zara");
  const [isActive, setIsActive] = useState(false);
  const [recordingRef, setRecordingRef] = useState<Audio.Recording | null>(null);
  const [soundRef, setSoundRef] = useState<Audio.Sound | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const chatHistory = useRef<AiChatMessage[]>([]);
  const callStateRef = useRef<CallState>("idle");

  // Animations
  const ring1 = useRef(new Animated.Value(1)).current;
  const ring2 = useRef(new Animated.Value(1)).current;
  const ring3 = useRef(new Animated.Value(1)).current;
  const glowOp = useRef(new Animated.Value(0.5)).current;
  const thinkRot = useRef(new Animated.Value(0)).current;
  const micScale = useRef(new Animated.Value(1)).current;
  const statusOp = useRef(new Animated.Value(1)).current;
  const orbPulse = useRef(new Animated.Value(1)).current;
  const waveAnims = useRef(
    Array.from({ length: 9 }, () => new Animated.Value(0.25))
  ).current;

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  // Glow loop
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(glowOp, { toValue: 0.9, duration: 2200, useNativeDriver: true }),
      Animated.timing(glowOp, { toValue: 0.3, duration: 2200, useNativeDriver: true }),
    ])).start();
  }, []);

  // Rings when active
  useEffect(() => {
    if (!isActive) { ring1.setValue(1); ring2.setValue(1); ring3.setValue(1); return; }
    const anims = [
      Animated.loop(Animated.sequence([Animated.timing(ring1, { toValue: 1.25, duration: 2000, useNativeDriver: true }), Animated.timing(ring1, { toValue: 1, duration: 2000, useNativeDriver: true })])),
      Animated.loop(Animated.sequence([Animated.timing(ring2, { toValue: 1.45, duration: 2600, delay: 300, useNativeDriver: true }), Animated.timing(ring2, { toValue: 1, duration: 2600, useNativeDriver: true })])),
      Animated.loop(Animated.sequence([Animated.timing(ring3, { toValue: 1.65, duration: 3200, delay: 600, useNativeDriver: true }), Animated.timing(ring3, { toValue: 1, duration: 3200, useNativeDriver: true })])),
    ];
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [isActive]);

  // Waveform when speaking
  useEffect(() => {
    if (callState === "speaking") {
      const anims = waveAnims.map((a, i) =>
        Animated.loop(Animated.sequence([
          Animated.timing(a, { toValue: 0.75 + (i % 3) * 0.1, duration: 180 + i * 55, useNativeDriver: true }),
          Animated.timing(a, { toValue: 0.15, duration: 180 + i * 55, useNativeDriver: true }),
        ]))
      );
      anims.forEach((a) => a.start());
      return () => anims.forEach((a) => a.stop());
    }
    waveAnims.forEach((a) => a.setValue(0.25));
  }, [callState]);

  // Thinking spin
  useEffect(() => {
    if (callState === "thinking") {
      Animated.loop(Animated.timing(thinkRot, { toValue: 1, duration: 1100, useNativeDriver: true })).start();
    } else {
      thinkRot.setValue(0);
    }
  }, [callState]);

  // Orb pulse when listening
  useEffect(() => {
    if (callState === "listening") {
      Animated.loop(Animated.sequence([
        Animated.timing(orbPulse, { toValue: 1.08, duration: 500, useNativeDriver: true }),
        Animated.timing(orbPulse, { toValue: 0.96, duration: 500, useNativeDriver: true }),
      ])).start();
    } else {
      orbPulse.setValue(1);
    }
  }, [callState]);

  const flashStatus = useCallback((msg: string) => {
    Animated.sequence([
      Animated.timing(statusOp, { toValue: 0, duration: 130, useNativeDriver: true }),
      Animated.timing(statusOp, { toValue: 1, duration: 130, useNativeDriver: true }),
    ]).start();
    setStatusMsg(msg);
  }, []);

  const pushMsg = (role: "user" | "zara", text: string) => {
    const id = `${Date.now()}${Math.random().toString(36).substr(2, 6)}`;
    setMessages((p) => [...p, { id, role, text }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  };

  const stopSound = async () => {
    if (soundRef) {
      try { await soundRef.stopAsync(); await soundRef.unloadAsync(); } catch {}
      setSoundRef(null);
    }
  };

  const endCall = async () => {
    await stopSound();
    if (recordingRef) {
      try { await recordingRef.stopAndUnloadAsync(); } catch {}
      setRecordingRef(null);
    }
    setIsActive(false);
    setCallState("idle");
    chatHistory.current = [];
    setMessages([]);
    setShowText(false);
    flashStatus("Tap Call to start talking with Zara");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const speakZara = async (text: string) => {
    setCallState("speaking");
    flashStatus("Zara is speaking…");
    if (!apiKeys.elevenlabsKey) {
      await new Promise((r) => setTimeout(r, 1200));
      setCallState("idle");
      flashStatus("Zara is ready · hold mic to talk");
      return;
    }
    try {
      const voiceId = apiKeys.elevenlabsVoiceId || ZARA_VOICE_ID;
      const b64 = await elevenLabsTtsBase64(apiKeys.elevenlabsKey, text, voiceId);
      const uri = `${cacheDirectory}zara_${Date.now()}.mp3`;
      await writeAsStringAsync(uri, b64, { encoding: EncodingType.Base64 });
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
      const { sound } = await Audio.Sound.createAsync({ uri });
      setSoundRef(sound);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded && s.didJustFinish) {
          sound.unloadAsync();
          setSoundRef(null);
          if (callStateRef.current === "speaking") {
            setCallState("idle");
            flashStatus("Zara is ready · hold mic to talk");
          }
        }
      });
    } catch (err: any) {
      console.warn("[TTS]", err.message);
      setCallState("idle");
      flashStatus("Zara is ready · hold mic to talk");
    }
  };

  const sendToZara = async (userText: string | null, mode: "chat" | "greet" = "chat") => {
    try {
      let reply = "";
      if (mode === "greet") {
        reply = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
      } else {
        if (!userText) return;
        setCallState("thinking");
        flashStatus("Zara is thinking…");
        chatHistory.current.push({ role: "user", content: userText });
        reply = await aiChat(apiKeys, chatHistory.current, ZARA_SYSTEM);
        chatHistory.current.push({ role: "assistant", content: reply });
      }
      pushMsg("zara", reply);
      await speakZara(reply);
    } catch (err: any) {
      setCallState("idle");
      flashStatus("Zara is ready · hold mic to talk");
      Alert.alert("Zara Error", err.message || "Something went wrong.");
    }
  };

  const startCall = () => {
    if (!apiKeys.openrouterKey && !apiKeys.huggingfaceKey) {
      Alert.alert("No AI Key", "Add your OpenRouter or HuggingFace key in Settings first.");
      return;
    }
    chatHistory.current = [];
    setMessages([]);
    setIsActive(true);
    setCallState("idle");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => sendToZara(null, "greet"), 600);
  };

  // Native: push-to-talk
  const onMicPressIn = async () => {
    if (!isActive || callState !== "idle") return;
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Mic Permission Needed", "Allow microphone access to talk to Zara.");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecordingRef(recording);
      setCallState("listening");
      flashStatus("Listening… release to send");
      Animated.spring(micScale, { toValue: 1.25, tension: 200, friction: 7, useNativeDriver: true }).start();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err: any) {
      Alert.alert("Mic Error", err.message);
    }
  };

  const onMicPressOut = async () => {
    Animated.spring(micScale, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }).start();
    if (!recordingRef) return;
    try {
      await recordingRef.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recordingRef.getURI();
      setRecordingRef(null);
      if (!uri) { setCallState("idle"); flashStatus("Zara is ready · hold mic to talk"); return; }

      if (!apiKeys.groqKey) {
        setCallState("idle");
        setShowText(true);
        flashStatus("Add Groq key for voice · type below");
        return;
      }
      setCallState("thinking");
      flashStatus("Zara is processing…");
      const b64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
      const url = new URL("/api/voice/transcribe", getApiUrl());
      const resp = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64: b64, groqKey: apiKeys.groqKey }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Transcription failed");
      const transcript: string = (data.transcript || "").trim();
      if (!transcript) { setCallState("idle"); flashStatus("Zara is ready · hold mic to talk"); return; }
      pushMsg("user", transcript);
      await sendToZara(transcript);
    } catch (err: any) {
      console.warn("[STT]", err.message);
      setCallState("idle");
      flashStatus("Zara is ready · hold mic to talk");
    }
  };

  // Web: tap for browser STT
  const onWebMic = () => {
    if (!isActive || callState !== "idle") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setShowText(true); return; }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    setCallState("listening");
    flashStatus("Listening… speak now");
    rec.onresult = async (e: any) => {
      const t: string = e.results[0][0].transcript;
      pushMsg("user", t);
      await sendToZara(t);
    };
    rec.onerror = () => { setCallState("idle"); flashStatus("Zara is ready · tap mic to talk"); };
    rec.onend = () => { if (callStateRef.current === "listening") { setCallState("idle"); flashStatus("Zara is ready · tap mic to talk"); } };
    rec.start();
  };

  const sendText = async () => {
    const t = textInput.trim();
    if (!t || callState !== "idle") return;
    setTextInput("");
    pushMsg("user", t);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await sendToZara(t);
  };

  const thinkSpin = thinkRot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const stateColor = callState === "listening" ? "#EF4444" : callState === "speaking" ? "#F59E0B" : callState === "thinking" ? "#A855F7" : ACCENT;
  const orbBorder = (stateColor) + "60";

  return (
    <View style={[z.container, { paddingTop: topPad }]}>
      {/* Top Bar */}
      <View style={z.topBar}>
        <Pressable onPress={() => { endCall(); router.back(); }} style={z.topBtn}>
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.75)" />
        </Pressable>
        <View style={z.topMid}>
          <Text style={z.topName}>Zara</Text>
          <Text style={[z.topState, { color: stateColor }]}>
            {!isActive ? "AI Voice Assistant" :
             callState === "idle" ? "🟢 Ready" :
             callState === "listening" ? "🔴 Listening" :
             callState === "thinking" ? "🟣 Thinking" : "🟡 Speaking"}
          </Text>
        </View>
        <Pressable onPress={() => router.push("/tools/settings" as any)} style={z.topBtn}>
          <Text style={z.pkFlag}>🇵🇰</Text>
        </Pressable>
      </View>

      {/* Scroll area */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[z.scroll, { paddingBottom: bottomPad + 140 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Orb section */}
        <View style={z.orbWrap}>
          {isActive && (
            <>
              <Animated.View style={[z.ring3, { transform: [{ scale: ring3 }], borderColor: stateColor + "10" }]} />
              <Animated.View style={[z.ring2, { transform: [{ scale: ring2 }], borderColor: stateColor + "1A" }]} />
              <Animated.View style={[z.ring1, { transform: [{ scale: ring1 }], borderColor: stateColor + "35" }]} />
            </>
          )}
          <Animated.View style={[z.glow, { backgroundColor: stateColor, opacity: glowOp }]} />
          <Animated.View style={[z.orb, { borderColor: orbBorder, transform: [{ scale: orbPulse }] }]}>
            {callState === "thinking" ? (
              <Animated.View style={{ transform: [{ rotate: thinkSpin }] }}>
                <MaterialCommunityIcons name="atom-variant" size={46} color="#A855F7" />
              </Animated.View>
            ) : (
              <>
                <Text style={z.orbEmoji}>
                  {callState === "listening" ? "🎙️" : callState === "speaking" ? "🔊" : "✨"}
                </Text>
                <Text style={z.orbLabel}>ZARA</Text>
              </>
            )}
          </Animated.View>
        </View>

        {/* Status */}
        <Animated.Text style={[z.status, { color: stateColor, opacity: statusOp }]}>
          {statusMsg}
        </Animated.Text>

        {/* Waveform */}
        {callState === "speaking" && (
          <View style={z.wave}>
            {waveAnims.map((a, i) => (
              <Animated.View
                key={i}
                style={[z.wbar, {
                  transform: [{ scaleY: a }],
                  backgroundColor: i % 2 === 0 ? ACCENT : ACCENT2,
                  height: 36 + (i % 3) * 8,
                }]}
              />
            ))}
          </View>
        )}

        {/* Chat bubbles */}
        {messages.length > 0 && (
          <View style={z.chat}>
            {messages.slice(-8).map((m) => (
              <View key={m.id} style={[z.bub, m.role === "user" ? z.bubUser : z.bubZara]}>
                {m.role === "zara" && (
                  <Text style={z.bubName}>✨ Zara</Text>
                )}
                <Text style={[z.bubText, m.role === "user" ? z.bubTextUser : z.bubTextZara]}>
                  {m.text}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Warnings */}
        {isActive && !apiKeys.elevenlabsKey && (
          <View style={z.warn}>
            <Ionicons name="volume-mute-outline" size={13} color="#F59E0B" />
            <Text style={z.warnTxt}>No ElevenLabs key — text only replies · add in Settings</Text>
          </View>
        )}
        {isActive && !apiKeys.groqKey && Platform.OS !== "web" && (
          <View style={z.warn}>
            <Ionicons name="mic-off-outline" size={13} color="#A855F7" />
            <Text style={z.warnTxt}>No Groq key — voice input disabled · add in Settings for STT</Text>
          </View>
        )}
      </ScrollView>

      {/* Controls */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[z.controls, { paddingBottom: Math.max(bottomPad + 8, 20) }]}>
          {!isActive ? (
            <Pressable onPress={startCall} style={z.callBtn}>
              <View style={z.callBtnInner}>
                <Ionicons name="call" size={34} color="#fff" />
              </View>
              <Text style={z.callBtnLabel}>Call Zara</Text>
            </Pressable>
          ) : (
            <>
              {showText && (
                <View style={z.textRow}>
                  <TextInput
                    style={z.textIn}
                    value={textInput}
                    onChangeText={setTextInput}
                    placeholder="Type to Zara…"
                    placeholderTextColor="rgba(255,255,255,0.28)"
                    returnKeyType="send"
                    onSubmitEditing={sendText}
                    editable={callState === "idle"}
                  />
                  <Pressable onPress={sendText} disabled={!textInput.trim() || callState !== "idle"} style={z.sendBtn}>
                    <Ionicons name="send" size={17} color="#fff" />
                  </Pressable>
                </View>
              )}
              <View style={z.row}>
                <Pressable onPress={() => setShowText((v) => !v)} style={[z.sideBtn, showText && { backgroundColor: ACCENT + "25" }]}>
                  <Ionicons name="chatbubble-outline" size={20} color={showText ? ACCENT : "rgba(255,255,255,0.45)"} />
                </Pressable>

                {Platform.OS === "web" ? (
                  <Pressable
                    onPress={onWebMic}
                    disabled={callState !== "idle"}
                    style={[z.micBtn, { borderColor: stateColor + "70", backgroundColor: stateColor + "18" }]}
                  >
                    <Animated.View style={{ transform: [{ scale: micScale }] }}>
                      <Ionicons
                        name={callState === "listening" ? "radio-button-on" : "mic"}
                        size={38}
                        color={stateColor}
                      />
                    </Animated.View>
                  </Pressable>
                ) : (
                  <Pressable
                    onPressIn={onMicPressIn}
                    onPressOut={onMicPressOut}
                    disabled={callState !== "idle"}
                    style={[z.micBtn, { borderColor: stateColor + "70", backgroundColor: stateColor + "18" }]}
                  >
                    <Animated.View style={{ transform: [{ scale: micScale }] }}>
                      <Ionicons
                        name={callState === "listening" ? "radio-button-on" : "mic"}
                        size={38}
                        color={stateColor}
                      />
                    </Animated.View>
                  </Pressable>
                )}

                <Pressable onPress={endCall} style={z.endBtn}>
                  <MaterialCommunityIcons name="phone-hangup" size={22} color="#fff" />
                </Pressable>
              </View>

              {Platform.OS !== "web" && (
                <Text style={z.hint}>
                  {apiKeys.groqKey ? "Hold mic · release to send" : "Tap 💬 to type or add Groq key for voice"}
                </Text>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const z = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  topBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 10, gap: 10,
  },
  topBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    justifyContent: "center", alignItems: "center",
  },
  topMid: { flex: 1, alignItems: "center" },
  topName: { fontFamily: "Poppins_700Bold", fontSize: 18, color: "#fff", letterSpacing: 0.3 },
  topState: { fontFamily: "Poppins_400Regular", fontSize: 11 },
  pkFlag: { fontSize: 22 },

  scroll: { alignItems: "center", paddingHorizontal: 20, paddingTop: 16 },

  orbWrap: { width: 230, height: 230, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  ring1: { position: "absolute", width: 158, height: 158, borderRadius: 79, borderWidth: 1.5 },
  ring2: { position: "absolute", width: 188, height: 188, borderRadius: 94, borderWidth: 1 },
  ring3: { position: "absolute", width: 218, height: 218, borderRadius: 109, borderWidth: 0.8 },
  glow: {
    position: "absolute", width: 128, height: 128, borderRadius: 64,
    shadowColor: ACCENT, shadowRadius: 30, shadowOpacity: 0.8,
    opacity: 0.1,
  },
  orb: {
    width: 128, height: 128, borderRadius: 64,
    backgroundColor: "rgba(16,185,129,0.1)",
    borderWidth: 2, justifyContent: "center", alignItems: "center", gap: 2,
  },
  orbEmoji: { fontSize: 30 },
  orbLabel: { fontFamily: "Poppins_700Bold", fontSize: 15, color: "#fff", letterSpacing: 4 },

  status: {
    fontFamily: "Poppins_500Medium", fontSize: 13,
    textAlign: "center", marginBottom: 16, paddingHorizontal: 24, lineHeight: 20,
  },

  wave: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 16 },
  wbar: { width: 5, borderRadius: 3 },

  chat: { width: "100%", gap: 10, marginTop: 6 },
  bub: { borderRadius: 16, padding: 12, maxWidth: "90%" },
  bubUser: {
    alignSelf: "flex-end", borderBottomRightRadius: 4,
    backgroundColor: "rgba(37,99,235,0.18)",
    borderWidth: 1, borderColor: "rgba(37,99,235,0.28)",
  },
  bubZara: {
    alignSelf: "flex-start", borderBottomLeftRadius: 4,
    backgroundColor: "rgba(16,185,129,0.1)",
    borderWidth: 1, borderColor: "rgba(16,185,129,0.22)",
  },
  bubName: { fontFamily: "Poppins_600SemiBold", fontSize: 9, color: ACCENT, marginBottom: 3, letterSpacing: 0.5 },
  bubText: { fontFamily: "Poppins_400Regular", fontSize: 13, lineHeight: 19 },
  bubTextUser: { color: "rgba(255,255,255,0.88)" },
  bubTextZara: { color: "rgba(255,255,255,0.82)" },

  warn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(245,158,11,0.08)",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
    marginTop: 10, borderWidth: 1, borderColor: "rgba(245,158,11,0.18)",
    width: "100%",
  },
  warnTxt: { fontFamily: "Poppins_400Regular", fontSize: 11, color: "#F59E0B", flex: 1 },

  controls: {
    backgroundColor: "#080014", borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 24, paddingTop: 14, gap: 10, alignItems: "center",
  },

  callBtn: { alignItems: "center", gap: 10, paddingVertical: 4 },
  callBtnInner: {
    width: 92, height: 92, borderRadius: 46, backgroundColor: ACCENT,
    justifyContent: "center", alignItems: "center",
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 20, elevation: 14,
  },
  callBtnLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: "#fff" },

  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 28 },
  sideBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.07)",
    justifyContent: "center", alignItems: "center",
  },
  micBtn: {
    width: 84, height: 84, borderRadius: 42,
    borderWidth: 2.5, justifyContent: "center", alignItems: "center",
  },
  endBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#DC2626",
    justifyContent: "center", alignItems: "center",
  },

  textRow: { flexDirection: "row", gap: 8, alignItems: "center", width: "100%" },
  textIn: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
    fontFamily: "Poppins_400Regular", fontSize: 14, color: "#fff",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: ACCENT, justifyContent: "center", alignItems: "center",
  },

  hint: {
    fontFamily: "Poppins_400Regular", fontSize: 11,
    color: "rgba(255,255,255,0.28)", textAlign: "center",
  },
});
