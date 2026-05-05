import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView, Platform,
  Image, ActivityIndicator, Alert, Share, Keyboard, FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import ToolHeader from "@/components/ToolHeader";
import { useApp } from "@/contexts/AppContext";
import { aiGenerate } from "@/lib/ai";

const STYLES = ["Photorealistic", "Digital Art", "Oil Painting", "Watercolor", "Anime", "Cartoon", "Sketch", "Cinematic", "Fantasy", "Cyberpunk", "Minimalist", "3D Render"];

const EXAMPLE_IDEAS = [
  "A majestic lion at sunset on African savanna",
  "Futuristic city floating in the clouds",
  "A cozy coffee shop in autumn rain",
  "Astronaut planting flowers on the moon",
  "Dragon flying over a medieval castle",
  "Underwater city with glowing coral reefs",
  "A magical forest with glowing fireflies",
  "Robot chef cooking in a modern kitchen",
];

const IMAGE_SIZES = [
  { label: "Square", w: 512, h: 512, icon: "square-outline" as const },
  { label: "Portrait", w: 512, h: 768, icon: "phone-portrait-outline" as const },
  { label: "Landscape", w: 768, h: 512, icon: "phone-landscape-outline" as const },
];

function buildPollinationsUrl(prompt: string, w: number, h: number, seed: number) {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=${w}&height=${h}&seed=${seed}&nologo=true&enhance=true&model=flux`;
}

type GeneratedImage = {
  id: string;
  url: string;
  prompt: string;
  style: string;
  idea: string;
  width: number;
  height: number;
  seed: number;
  timestamp: number;
};

export default function AIImageGenerator() {
  const insets = useSafeAreaInsets();
  const { apiKeys, hasAiKey } = useApp();
  const [idea, setIdea] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("Photorealistic");
  const [selectedSize, setSelectedSize] = useState(IMAGE_SIZES[0]);
  const [loading, setLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [currentImage, setCurrentImage] = useState<GeneratedImage | null>(null);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [enhancedPrompt, setEnhancedPrompt] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  const generate = async (useEnhanced = false) => {
    const inputIdea = idea.trim();
    if (!inputIdea) { Alert.alert("Input Required", "Please enter an idea for your image."); return; }
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let finalPrompt = inputIdea;

    if (!useEnhanced && hasAiKey) {
      setEnhancing(true);
      try {
        const enhanced = await aiGenerate(
          apiKeys,
          `Idea: "${inputIdea}"${selectedStyle ? ` in ${selectedStyle} style` : ""}`,
          "You are an expert AI image prompt engineer. Output ONLY a vivid, highly detailed image-generation prompt (max 150 words). Include colors, lighting, composition, and artistic style. No quotes, no explanation.",
          { maxTokens: 300, temperature: 0.9 },
        );
        if (enhanced) {
          finalPrompt = enhanced;
          setEnhancedPrompt(enhanced);
        }
      } catch {
        finalPrompt = `${inputIdea}, ${selectedStyle.toLowerCase()} style, highly detailed, professional`;
      } finally {
        setEnhancing(false);
      }
    } else if (!useEnhanced) {
      finalPrompt = `${inputIdea}, ${selectedStyle.toLowerCase()} style, highly detailed, professional`;
    }

    setLoading(true);
    setImageLoading(true);
    setImageError(false);

    const seed = Math.floor(Math.random() * 999999);
    const imgUrl = buildPollinationsUrl(finalPrompt, selectedSize.w, selectedSize.h, seed);

    const newImage: GeneratedImage = {
      id: Date.now().toString(),
      url: imgUrl,
      prompt: finalPrompt,
      style: selectedStyle,
      idea: inputIdea,
      width: selectedSize.w,
      height: selectedSize.h,
      seed,
      timestamp: Date.now(),
    };

    setCurrentImage(newImage);
    setHistory((prev) => [newImage, ...prev.slice(0, 19)]);
    setLoading(false);
  };

  const regenerate = () => {
    if (!currentImage) return;
    const seed = Math.floor(Math.random() * 999999);
    const newUrl = buildPollinationsUrl(currentImage.prompt, currentImage.width, currentImage.height, seed);
    const newImage = { ...currentImage, id: Date.now().toString(), url: newUrl, seed, timestamp: Date.now() };
    setCurrentImage(newImage);
    setHistory((prev) => [newImage, ...prev.slice(0, 19)]);
    setImageLoading(true);
    setImageError(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleShare = async () => {
    if (!currentImage) return;
    try {
      await Share.share({ message: `Check out this AI-generated image! Prompt: "${currentImage.idea}"`, url: currentImage.url });
    } catch { }
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <ToolHeader
        title="AI Image Generator"
        subtitle="Generate images from text using AI"
        accentColor="#7C3AED"
        rightElement={
          history.length > 0 ? (
            <Pressable onPress={() => setShowHistory(!showHistory)} style={styles.historyBtn}>
              <Ionicons name="images-outline" size={16} color="#7C3AED" />
              <Text style={styles.historyBtnText}>{history.length}</Text>
            </Pressable>
          ) : undefined
        }
      />

      {showHistory ? (
        <View style={{ flex: 1 }}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Generated Images ({history.length})</Text>
            <Pressable onPress={() => setShowHistory(false)} style={styles.closeHistBtn}>
              <Ionicons name="close" size={18} color={Colors.text} />
            </Pressable>
          </View>
          <FlatList
            data={history}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: bottomPad + 80 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { setCurrentImage(item); setShowHistory(false); setImageLoading(true); setImageError(false); }}
                style={styles.historyCard}
              >
                <Image source={{ uri: item.url }} style={styles.historyImg} resizeMode="cover" />
                <Text style={styles.historyCardIdea} numberOfLines={2}>{item.idea}</Text>
                <Text style={styles.historyCardStyle}>{item.style}</Text>
              </Pressable>
            )}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 20 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.inputCard}>
            <Text style={styles.label}>Describe Your Image</Text>
            <TextInput
              style={styles.ideaInput}
              value={idea}
              onChangeText={setIdea}
              placeholder="e.g. A majestic lion at sunset..."
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={300}
              returnKeyType="done"
              onSubmitEditing={() => generate()}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              <View style={styles.exampleRow}>
                {EXAMPLE_IDEAS.map((ex) => (
                  <Pressable key={ex} onPress={() => setIdea(ex)} style={styles.exampleChip}>
                    <Text style={styles.exampleText} numberOfLines={1}>{ex}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.optionCard}>
            <Text style={styles.label}>Art Style</Text>
            <View style={styles.styleGrid}>
              {STYLES.map((s) => (
                <Pressable key={s} onPress={() => { setSelectedStyle(s); Haptics.selectionAsync(); }} style={[styles.styleChip, selectedStyle === s && styles.styleChipActive]}>
                  <Text style={[styles.styleText, selectedStyle === s && styles.styleTextActive]}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.optionCard}>
            <Text style={styles.label}>Image Size</Text>
            <View style={styles.sizeRow}>
              {IMAGE_SIZES.map((size) => (
                <Pressable key={size.label} onPress={() => { setSelectedSize(size); Haptics.selectionAsync(); }} style={[styles.sizeBtn, selectedSize.label === size.label && styles.sizeBtnActive]}>
                  <Ionicons name={size.icon} size={20} color={selectedSize.label === size.label ? Colors.white : Colors.textSecondary} />
                  <Text style={[styles.sizeBtnText, selectedSize.label === size.label && { color: Colors.white }]}>{size.label}</Text>
                  <Text style={[styles.sizeBtnDim, selectedSize.label === size.label && { color: "rgba(255,255,255,0.7)" }]}>{size.w}×{size.h}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable
            onPress={() => generate()}
            disabled={loading || enhancing || !idea.trim()}
            style={({ pressed }) => [styles.generateBtn, { opacity: loading || enhancing || !idea.trim() ? 0.5 : pressed ? 0.9 : 1 }]}
          >
            {loading || enhancing ? (
              <>
                <ActivityIndicator size="small" color={Colors.white} />
                <Text style={styles.generateBtnText}>{enhancing ? "Enhancing prompt..." : "Generating..."}</Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons name="image-auto-adjust" size={20} color={Colors.white} />
                <Text style={styles.generateBtnText}>Generate Image</Text>
              </>
            )}
          </Pressable>

          {currentImage && (
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultTitle}>Generated Image</Text>
                <View style={styles.resultActions}>
                  <Pressable onPress={regenerate} style={styles.resultActionBtn}>
                    <Ionicons name="refresh" size={16} color={Colors.primary} />
                  </Pressable>
                  <Pressable onPress={handleShare} style={styles.resultActionBtn}>
                    <Ionicons name="share-outline" size={16} color={Colors.primary} />
                  </Pressable>
                </View>
              </View>

              <View style={[styles.imageContainer, { aspectRatio: currentImage.width / currentImage.height }]}>
                {imageLoading && (
                  <View style={styles.imageLoader}>
                    <ActivityIndicator size="large" color="#7C3AED" />
                    <Text style={styles.imageLoaderText}>Generating your image...{"\n"}This may take 15-30 seconds</Text>
                  </View>
                )}
                {imageError ? (
                  <View style={styles.imageError}>
                    <Ionicons name="image-outline" size={48} color={Colors.textMuted} />
                    <Text style={styles.imageErrorText}>Image generation failed</Text>
                    <Pressable onPress={regenerate} style={styles.retryBtn}>
                      <Text style={styles.retryBtnText}>Try Again</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Image
                    source={{ uri: currentImage.url }}
                    style={[styles.generatedImage, imageLoading && { opacity: 0 }]}
                    resizeMode="contain"
                    onLoad={() => { setImageLoading(false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}
                    onError={() => { setImageLoading(false); setImageError(true); }}
                  />
                )}
              </View>

              <View style={styles.promptInfo}>
                <View style={styles.promptRow}>
                  <Ionicons name="bulb-outline" size={14} color="#7C3AED" />
                  <Text style={styles.promptLabel}>Your idea:</Text>
                </View>
                <Text style={styles.promptText}>{currentImage.idea}</Text>
                {currentImage.prompt !== currentImage.idea && (
                  <>
                    <View style={[styles.promptRow, { marginTop: 8 }]}>
                      <Ionicons name="sparkles-outline" size={14} color="#7C3AED" />
                      <Text style={styles.promptLabel}>AI-enhanced prompt:</Text>
                    </View>
                    <Text style={[styles.promptText, styles.promptEnhanced]} numberOfLines={4}>{currentImage.prompt}</Text>
                  </>
                )}
                <View style={styles.promptMeta}>
                  <View style={styles.promptMetaChip}>
                    <Ionicons name="color-palette-outline" size={11} color={Colors.textMuted} />
                    <Text style={styles.promptMetaText}>{currentImage.style}</Text>
                  </View>
                  <View style={styles.promptMetaChip}>
                    <Ionicons name="resize-outline" size={11} color={Colors.textMuted} />
                    <Text style={styles.promptMetaText}>{currentImage.width}×{currentImage.height}</Text>
                  </View>
                  <View style={styles.promptMetaChip}>
                    <Ionicons name="shuffle-outline" size={11} color={Colors.textMuted} />
                    <Text style={styles.promptMetaText}>Seed {currentImage.seed}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.resultBtnRow}>
                <Pressable onPress={regenerate} style={[styles.resultBtn, styles.resultBtnOutline]}>
                  <Ionicons name="refresh" size={15} color="#7C3AED" />
                  <Text style={[styles.resultBtnText, { color: "#7C3AED" }]}>New Variation</Text>
                </Pressable>
                <Pressable onPress={handleShare} style={[styles.resultBtn, { backgroundColor: "#7C3AED" }]}>
                  <Ionicons name="share-outline" size={15} color={Colors.white} />
                  <Text style={[styles.resultBtnText, { color: Colors.white }]}>Share</Text>
                </Pressable>
              </View>
            </View>
          )}

          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="information-outline" size={16} color={Colors.primary} />
            <Text style={styles.infoText}>Images are generated using Pollinations.ai (free, unlimited). AI enhances your prompt for better results. Tap "New Variation" to get a different image with the same prompt.</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 16, gap: 14 },
  inputCard: { backgroundColor: Colors.white, borderRadius: 18, padding: 16, gap: 8, borderWidth: 1, borderColor: Colors.cardBorder },
  label: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  ideaInput: { fontFamily: "Poppins_400Regular", fontSize: 15, color: Colors.text, backgroundColor: Colors.separator, borderRadius: 12, padding: 14, minHeight: 80, borderWidth: 1, borderColor: Colors.cardBorder, textAlignVertical: "top" },
  exampleRow: { flexDirection: "row", gap: 8 },
  exampleChip: { backgroundColor: Colors.primaryLight, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.primary },
  exampleText: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.primary, maxWidth: 180 },
  optionCard: { backgroundColor: Colors.white, borderRadius: 18, padding: 16, gap: 10, borderWidth: 1, borderColor: Colors.cardBorder },
  styleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  styleChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: Colors.separator, borderWidth: 1, borderColor: Colors.cardBorder },
  styleChipActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
  styleText: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.textSecondary },
  styleTextActive: { color: Colors.white, fontFamily: "Poppins_600SemiBold" },
  sizeRow: { flexDirection: "row", gap: 8 },
  sizeBtn: { flex: 1, backgroundColor: Colors.separator, borderRadius: 12, padding: 12, alignItems: "center", gap: 4, borderWidth: 1, borderColor: Colors.cardBorder },
  sizeBtnActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
  sizeBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: Colors.textSecondary },
  sizeBtnDim: { fontFamily: "Poppins_400Regular", fontSize: 10, color: Colors.textMuted },
  generateBtn: { backgroundColor: "#7C3AED", borderRadius: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  generateBtnText: { fontFamily: "Poppins_700Bold", fontSize: 16, color: Colors.white },
  resultCard: { backgroundColor: Colors.white, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: Colors.cardBorder },
  resultHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, paddingBottom: 10 },
  resultTitle: { fontFamily: "Poppins_700Bold", fontSize: 15, color: Colors.text },
  resultActions: { flexDirection: "row", gap: 8 },
  resultActionBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.primaryLight, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: Colors.primary },
  imageContainer: { width: "100%", backgroundColor: "#F8F6FF", position: "relative" },
  generatedImage: { width: "100%", height: "100%" },
  imageLoader: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", gap: 12, backgroundColor: "#F8F6FF" },
  imageLoaderText: { fontFamily: "Poppins_400Regular", fontSize: 13, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  imageError: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", gap: 10, backgroundColor: "#F8F6FF" },
  imageErrorText: { fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.textSecondary },
  retryBtn: { backgroundColor: "#7C3AED", borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8 },
  retryBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: Colors.white },
  promptInfo: { padding: 14, gap: 4 },
  promptRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  promptLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: Colors.textSecondary },
  promptText: { fontFamily: "Poppins_400Regular", fontSize: 13, color: Colors.text, lineHeight: 20 },
  promptEnhanced: { color: "#7C3AED", fontFamily: "Poppins_400Regular", fontSize: 11, lineHeight: 18 },
  promptMeta: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 8 },
  promptMetaChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.separator, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  promptMetaText: { fontFamily: "Poppins_400Regular", fontSize: 10, color: Colors.textMuted },
  resultBtnRow: { flexDirection: "row", gap: 10, padding: 14, paddingTop: 4 },
  resultBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12 },
  resultBtnOutline: { backgroundColor: Colors.white, borderWidth: 1.5, borderColor: "#7C3AED" },
  resultBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 14 },
  historyBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F3EEFF", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "#DDD6FE" },
  historyBtnText: { fontFamily: "Poppins_700Bold", fontSize: 12, color: "#7C3AED" },
  historyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  historyTitle: { fontFamily: "Poppins_700Bold", fontSize: 16, color: Colors.text },
  closeHistBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.separator, justifyContent: "center", alignItems: "center" },
  historyCard: { flex: 1, margin: 4, borderRadius: 12, overflow: "hidden", backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.cardBorder },
  historyImg: { width: "100%", aspectRatio: 1, backgroundColor: Colors.separator },
  historyCardIdea: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.text, padding: 8, paddingBottom: 2 },
  historyCardStyle: { fontFamily: "Poppins_600SemiBold", fontSize: 10, color: "#7C3AED", paddingHorizontal: 8, paddingBottom: 8 },
  infoCard: { flexDirection: "row", gap: 10, backgroundColor: Colors.primaryLight, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.primary, alignItems: "flex-start" },
  infoText: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.primary, flex: 1, lineHeight: 18 },
});
