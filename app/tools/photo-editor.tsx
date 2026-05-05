import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, Pressable, Platform, TextInput,
  Alert, ScrollView, Modal, KeyboardAvoidingView, useWindowDimensions,
} from "react-native";
import { WebView } from "react-native-webview";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { documentDirectory, writeAsStringAsync, EncodingType } from "expo-file-system/legacy";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ToolHeader from "@/components/ToolHeader";
import { Colors } from "@/constants/colors";

const ACCENT = "#7C3AED";
const DARK = "#0F0A2E";

// ── Filters ──────────────────────────────────────────────────────────────────
const FILTERS = [
  { id: "none",    label: "Original", emoji: "🖼️", css: "" },
  { id: "vivid",   label: "Vivid",   emoji: "✨", css: "saturate(1.8) contrast(1.1)" },
  { id: "cool",    label: "Cool",    emoji: "❄️", css: "hue-rotate(30deg) saturate(1.3)" },
  { id: "warm",    label: "Warm",    emoji: "🌅", css: "hue-rotate(-30deg) saturate(1.4) brightness(1.05)" },
  { id: "bw",      label: "B&W",     emoji: "⚫", css: "grayscale(1)" },
  { id: "sepia",   label: "Sepia",   emoji: "🍂", css: "sepia(0.85)" },
  { id: "fade",    label: "Fade",    emoji: "🌫️", css: "contrast(0.8) saturate(0.7) brightness(1.1)" },
  { id: "drama",   label: "Drama",   emoji: "🎭", css: "contrast(1.4) saturate(1.2)" },
  { id: "chrome",  label: "Chrome",  emoji: "🔵", css: "contrast(1.3) saturate(1.5) hue-rotate(10deg)" },
  { id: "matte",   label: "Matte",   emoji: "🟫", css: "contrast(0.9) brightness(1.1) sepia(0.2)" },
  { id: "night",   label: "Night",   emoji: "🌙", css: "brightness(0.7) contrast(1.3) saturate(1.1)" },
  { id: "summer",  label: "Summer",  emoji: "☀️", css: "saturate(1.6) brightness(1.1) hue-rotate(-15deg)" },
  { id: "neon",    label: "Neon",    emoji: "💜", css: "saturate(2) contrast(1.2) hue-rotate(260deg)" },
  { id: "vintage", label: "Vintage", emoji: "📷", css: "sepia(0.5) contrast(0.9) brightness(0.9) saturate(0.8)" },
];

// ── Draw colors ───────────────────────────────────────────────────────────────
const DRAW_COLORS = ["#EF4444","#F97316","#EAB308","#22C55E","#06B6D4","#3B82F6","#8B5CF6","#EC4899","#000000","#FFFFFF"];

// ── Stickers ──────────────────────────────────────────────────────────────────
const STICKERS = [
  "❤️","🔥","⭐","😍","🎉","💯","✅","😂","🤩","👑",
  "🌈","🦋","🌸","🎵","💎","🚀","🌙","⚡","🍀","🎯",
  "🥰","😎","🤔","😊","🤣","💪","👏","🙌","✨","🌟",
  "🎁","🎀","🎈","🎊","🍕","🍔","🍦","🧁","☕","🎮",
];

// ── Canvas HTML ───────────────────────────────────────────────────────────────
function buildCanvasHtml(imageUri: string) {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
body{background:#0A0A14;width:100vw;height:100vh;overflow:hidden;display:flex;align-items:center;justify-content:center;touch-action:none;}
canvas{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);}
#base{z-index:1;}
#overlay{z-index:2;}
</style></head>
<body>
<canvas id="base"></canvas>
<canvas id="overlay"></canvas>
<script>
var W=window.innerWidth, H=window.innerHeight;
var base=document.getElementById('base'), bCtx=base.getContext('2d');
var ov=document.getElementById('overlay'), oCtx=ov.getContext('2d');
var img=new Image();
var items=[];          // text + sticker items
var paths=[];          // draw paths
var curPath=null;
var history=[];        // undo snapshots
var redoStack=[];
var tool='none';       // draw | select
var drawColor='#EF4444', drawSize=6;
var filterCss='', brightness=100, contrast=100, saturation=100, exposure=0;
var rotation=0, flipH=false, flipV=false;
var drag=null, dragOffX=0, dragOffY=0;
var cW=W, cH=H;

img.crossOrigin='anonymous';
img.onload=function(){
  var iW=img.naturalWidth, iH=img.naturalHeight;
  var scale=Math.min(W/iW, H/iH);
  cW=Math.round(iW*scale); cH=Math.round(iH*scale);
  base.width=ov.width=cW; base.height=ov.height=cH;
  drawBase();
};
img.src='${imageUri}';

function buildFilter(){
  var parts=[];
  if(filterCss) parts.push(filterCss);
  if(brightness!==100) parts.push('brightness('+brightness/100+')');
  if(contrast!==100) parts.push('contrast('+contrast/100+')');
  if(saturation!==100) parts.push('saturate('+saturation/100+')');
  if(exposure!==0) parts.push('brightness('+(1+exposure/200)+')');
  return parts.join(' ')||'none';
}

function drawBase(){
  bCtx.save();
  bCtx.clearRect(0,0,cW,cH);
  bCtx.filter=buildFilter();
  bCtx.translate(cW/2,cH/2);
  if(flipH) bCtx.scale(-1,1);
  if(flipV) bCtx.scale(1,-1);
  bCtx.rotate(rotation*Math.PI/180);
  bCtx.drawImage(img,-cW/2,-cH/2,cW,cH);
  bCtx.restore();
}

function drawOverlay(){
  oCtx.clearRect(0,0,cW,cH);
  // Draw paths
  paths.forEach(function(p){
    if(!p.pts||p.pts.length<2) return;
    oCtx.save();
    oCtx.strokeStyle=p.color; oCtx.lineWidth=p.size;
    oCtx.lineCap='round'; oCtx.lineJoin='round';
    oCtx.beginPath(); oCtx.moveTo(p.pts[0].x,p.pts[0].y);
    p.pts.forEach(function(pt){oCtx.lineTo(pt.x,pt.y);});
    oCtx.stroke(); oCtx.restore();
  });
  // Draw items (text + stickers)
  items.forEach(function(it,idx){
    oCtx.save();
    if(it.type==='text'){
      var fw=it.bold?'700':'500';
      oCtx.font=fw+' '+it.size+'px Helvetica,Arial,sans-serif';
      oCtx.textAlign='center'; oCtx.textBaseline='middle';
      // Stroke for readability
      oCtx.strokeStyle='rgba(0,0,0,0.55)'; oCtx.lineWidth=3;
      oCtx.strokeText(it.text,it.x,it.y);
      oCtx.fillStyle=it.color; oCtx.fillText(it.text,it.x,it.y);
      // Selection ring
      if(drag&&drag.idx===idx){
        var m=oCtx.measureText(it.text);
        oCtx.strokeStyle='rgba(255,255,255,0.9)'; oCtx.lineWidth=1.5;
        oCtx.setLineDash([4,3]);
        oCtx.strokeRect(it.x-m.width/2-6,it.y-it.size/2-6,m.width+12,it.size+12);
      }
    } else if(it.type==='sticker'){
      oCtx.font=it.size+'px serif';
      oCtx.textAlign='center'; oCtx.textBaseline='middle';
      oCtx.fillText(it.emoji,it.x,it.y);
    }
    oCtx.restore();
  });
}

function redraw(){drawBase();drawOverlay();}

function hitTest(x,y){
  for(var i=items.length-1;i>=0;i--){
    var it=items[i];
    var hw= it.type==='text'? it.size*it.text.length*0.35 : it.size/2+4;
    var hh= it.type==='text'? it.size/2+8 : it.size/2+4;
    if(x>=it.x-hw && x<=it.x+hw && y>=it.y-hh && y<=it.y+hh) return i;
  }
  return -1;
}

function getPos(e){
  var r=ov.getBoundingClientRect();
  var src=e.touches?e.touches[0]:e;
  return {x:src.clientX-r.left, y:src.clientY-r.top};
}

// Touch on overlay
ov.addEventListener('touchstart',function(e){
  e.preventDefault();
  var p=getPos(e);
  if(tool==='draw'){
    saveHistory();
    curPath={color:drawColor,size:drawSize,pts:[p]};
    paths.push(curPath);
  } else if(tool==='select'){
    var idx=hitTest(p.x,p.y);
    if(idx>=0){ drag={idx:idx}; dragOffX=p.x-items[idx].x; dragOffY=p.y-items[idx].y; drawOverlay(); }
    else drag=null;
  }
},{passive:false});

ov.addEventListener('touchmove',function(e){
  e.preventDefault();
  var p=getPos(e);
  if(tool==='draw'&&curPath){ curPath.pts.push(p); drawOverlay(); }
  else if(tool==='select'&&drag){ items[drag.idx].x=p.x-dragOffX; items[drag.idx].y=p.y-dragOffY; drawOverlay(); }
},{passive:false});

ov.addEventListener('touchend',function(e){
  e.preventDefault();
  curPath=null;
  if(drag){drag=null;drawOverlay();}
},{passive:false});

function saveHistory(){
  history.push({items:JSON.stringify(items),paths:JSON.stringify(paths)});
  if(history.length>30) history.shift();
  redoStack=[];
}

function undo(){
  if(!history.length) return;
  redoStack.push({items:JSON.stringify(items),paths:JSON.stringify(paths)});
  var s=history.pop();
  items=JSON.parse(s.items); paths=JSON.parse(s.paths);
  redraw();
}

function redo(){
  if(!redoStack.length) return;
  history.push({items:JSON.stringify(items),paths:JSON.stringify(paths)});
  var s=redoStack.pop();
  items=JSON.parse(s.items); paths=JSON.parse(s.paths);
  redraw();
}

function exportImage(){
  var exp=document.createElement('canvas');
  exp.width=cW; exp.height=cH;
  var ctx=exp.getContext('2d');
  ctx.drawImage(base,0,0);
  ctx.drawImage(ov,0,0);
  var data=exp.toDataURL('image/jpeg',0.92);
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'export',data:data}));
}

// Command API called from RN via injectJavaScript
window.editorCmd=function(cmd){
  var c=JSON.parse(cmd);
  if(c.tool!==undefined){ tool=c.tool; drag=null; }
  if(c.filter!==undefined){ filterCss=c.filter; drawBase(); }
  if(c.brightness!==undefined){ brightness=c.brightness; drawBase(); }
  if(c.contrast!==undefined){ contrast=c.contrast; drawBase(); }
  if(c.saturation!==undefined){ saturation=c.saturation; drawBase(); }
  if(c.exposure!==undefined){ exposure=c.exposure; drawBase(); }
  if(c.drawColor!==undefined) drawColor=c.drawColor;
  if(c.drawSize!==undefined) drawSize=c.drawSize;
  if(c.rotate!==undefined){ saveHistory(); rotation=(rotation+c.rotate+360)%360; redraw(); }
  if(c.flipH){ saveHistory(); flipH=!flipH; redraw(); }
  if(c.flipV){ saveHistory(); flipV=!flipV; redraw(); }
  if(c.addText){
    saveHistory();
    items.push({type:'text',x:cW/2,y:cH/2+items.length*40,text:c.addText,color:c.textColor||'#FFFFFF',size:c.textSize||42,bold:c.bold||false});
    drawOverlay();
  }
  if(c.addSticker){
    saveHistory();
    items.push({type:'sticker',x:cW/2,y:cH/2+items.length*60,emoji:c.addSticker,size:64});
    drawOverlay();
  }
  if(c.deleteSelected&&drag){ saveHistory(); items.splice(drag.idx,1); drag=null; drawOverlay(); }
  if(c.clearDraw){ saveHistory(); paths=[]; drawOverlay(); }
  if(c.undo) undo();
  if(c.redo) redo();
  if(c.export) exportImage();
};
</script>
</body></html>`;
}

// ── Main component ─────────────────────────────────────────────────────────────
type ActiveTab = "filter" | "draw" | "text" | "sticker" | "adjust";

export default function PhotoEditorScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const webRef = useRef<WebView>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("filter");
  const [selectedFilter, setSelectedFilter] = useState(FILTERS[0]);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [exposure, setExposure] = useState(0);
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);
  const [drawSize, setDrawSize] = useState(6);
  const [textInput, setTextInput] = useState("");
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [textSize, setTextSize] = useState(42);
  const [textBold, setTextBold] = useState(false);
  const [showTextModal, setShowTextModal] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [exporting, setExporting] = useState(false);

  const cmd = useCallback((obj: Record<string, any>) => {
    webRef.current?.injectJavaScript(`window.editorCmd(${JSON.stringify(JSON.stringify(obj))});true;`);
  }, []);

  const setTool = useCallback((tool: string) => {
    cmd({ tool });
  }, [cmd]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed", "Allow photo library access."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setBrightness(100); setContrast(100); setSaturation(100); setExposure(0);
      setSelectedFilter(FILTERS[0]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed", "Allow camera access."); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setBrightness(100); setContrast(100); setSaturation(100); setExposure(0);
      setSelectedFilter(FILTERS[0]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const applyFilter = (f: typeof FILTERS[0]) => {
    setSelectedFilter(f);
    cmd({ filter: f.css });
    Haptics.selectionAsync();
  };

  const applyBrightness = (v: number) => { setBrightness(v); cmd({ brightness: v }); };
  const applyContrast = (v: number) => { setContrast(v); cmd({ contrast: v }); };
  const applySaturation = (v: number) => { setSaturation(v); cmd({ saturation: v }); };
  const applyExposure = (v: number) => { setExposure(v); cmd({ exposure: v }); };

  const handleDrawColor = (c: string) => { setDrawColor(c); cmd({ drawColor: c }); Haptics.selectionAsync(); };
  const handleDrawSize = (s: number) => { setDrawSize(s); cmd({ drawSize: s }); };

  const addText = () => {
    if (!textInput.trim()) return;
    cmd({ addText: textInput.trim(), textColor, textSize, bold: textBold });
    cmd({ tool: "select" });
    setTextInput("");
    setShowTextModal(false);
    setCanUndo(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const addSticker = (emoji: string) => {
    cmd({ addSticker: emoji });
    cmd({ tool: "select" });
    setCanUndo(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleExport = async () => {
    setExporting(true);
    cmd({ export: true });
  };

  const onMessage = async (e: any) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === "export") {
        setExporting(false);
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission needed", "Allow media library access to save photo.");
          return;
        }
        // Write base64 to file and save
        const base64 = msg.data.replace("data:image/jpeg;base64,", "");
        const path = (documentDirectory ?? "") + `zeno_edit_${Date.now()}.jpg`;
        await writeAsStringAsync(path, base64, { encoding: EncodingType.Base64 });
        await MediaLibrary.saveToLibraryAsync(path);
        Alert.alert("Saved!", "Your edited photo has been saved to the camera roll.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (_) {}
  };

  const TABS: { id: ActiveTab; icon: string; label: string; lib?: "community" }[] = [
    { id: "filter",  icon: "sparkles-outline",       label: "Filter" },
    { id: "draw",    icon: "pencil-outline",          label: "Draw" },
    { id: "text",    icon: "text-outline",            label: "Text" },
    { id: "sticker", icon: "happy-outline",           label: "Sticker" },
    { id: "adjust",  icon: "options-outline",         label: "Adjust" },
  ];

  const onTabPress = (tab: ActiveTab) => {
    setActiveTab(tab);
    Haptics.selectionAsync();
    if (tab === "draw") setTool("draw");
    else if (tab === "sticker" || tab === "text") setTool("select");
    else setTool("none");
  };

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <ToolHeader
        title="Photo Editor"
        subtitle="Canva-style editing tools"
        accentColor={ACCENT}
        rightElement={
          imageUri ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => { cmd({ undo: true }); Haptics.selectionAsync(); }} style={s.topBtn}>
                <Ionicons name="arrow-undo" size={17} color={Colors.textSecondary} />
              </Pressable>
              <Pressable onPress={() => { cmd({ redo: true }); Haptics.selectionAsync(); }} style={s.topBtn}>
                <Ionicons name="arrow-redo" size={17} color={Colors.textSecondary} />
              </Pressable>
              <Pressable onPress={handleExport} style={[s.topBtn, { backgroundColor: ACCENT }]}>
                {exporting
                  ? <MaterialCommunityIcons name="loading" size={17} color="#fff" />
                  : <Ionicons name="download-outline" size={17} color="#fff" />}
              </Pressable>
            </View>
          ) : undefined
        }
      />

      {!imageUri ? (
        /* ── EMPTY STATE ── */
        <View style={s.empty}>
          <View style={s.emptyGlow} />
          <View style={s.emptyIconWrap}>
            <MaterialCommunityIcons name="palette" size={64} color={ACCENT} />
          </View>
          <Text style={s.emptyTitle}>Canva-Style Editor</Text>
          <Text style={s.emptyDesc}>
            Add text, draw, stickers, filters & adjustments on any photo — just like Canva, right in your app.
          </Text>
          <View style={s.featureRow}>
            {["🎨 Filters","✏️ Draw","T Text","😊 Stickers","⚙️ Adjust"].map((f) => (
              <View key={f} style={s.featureChip}><Text style={s.featureChipText}>{f}</Text></View>
            ))}
          </View>
          <Pressable onPress={pickImage} style={s.pickBtn}>
            <Ionicons name="images-outline" size={22} color="#fff" />
            <Text style={s.pickBtnText}>Choose from Library</Text>
          </Pressable>
          <Pressable onPress={takePhoto} style={s.pickBtnOutline}>
            <Ionicons name="camera-outline" size={22} color={ACCENT} />
            <Text style={[s.pickBtnText, { color: ACCENT }]}>Take a Photo</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* ── CANVAS ── */}
          <View style={s.canvas}>
            <WebView
              ref={webRef}
              source={{ html: buildCanvasHtml(imageUri) }}
              style={{ flex: 1, backgroundColor: "#0A0A14" }}
              scrollEnabled={false}
              onMessage={onMessage}
              allowFileAccess
              originWhitelist={["*"]}
            />
          </View>

          {/* ── BOTTOM TOOLBAR ── */}
          <View style={[s.toolbar, { paddingBottom: bottomPad + 4 }]}>
            {/* Tab content */}
            <View style={s.tabContent}>
              {activeTab === "filter" && (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
                    {FILTERS.map((f) => (
                      <Pressable key={f.id} onPress={() => applyFilter(f)} style={[s.filterChip, selectedFilter.id === f.id && s.filterChipOn]}>
                        <Text style={s.filterEmoji}>{f.emoji}</Text>
                        <Text style={[s.filterLabel, selectedFilter.id === f.id && s.filterLabelOn]}>{f.label}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <View style={s.sliderSection}>
                    <MiniSlider label="Brightness" value={brightness} min={10} max={200} color="#F59E0B" icon="sunny-outline" onChange={applyBrightness} />
                    <MiniSlider label="Contrast" value={contrast} min={10} max={200} color="#0891B2" icon="contrast-outline" onChange={applyContrast} />
                  </View>
                </>
              )}

              {activeTab === "draw" && (
                <View style={s.drawPanel}>
                  <Text style={s.panelLabel}>Color</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                    {DRAW_COLORS.map((c) => (
                      <Pressable key={c} onPress={() => handleDrawColor(c)} style={[s.colorDot, { backgroundColor: c, borderWidth: drawColor === c ? 3 : 1.5, borderColor: drawColor === c ? ACCENT : "rgba(0,0,0,0.15)" }]} />
                    ))}
                  </ScrollView>
                  <View style={s.sizeLabelRow}>
                    <Text style={s.panelLabel}>Brush Size</Text>
                    <Text style={[s.panelLabel, { color: ACCENT }]}>{drawSize}px</Text>
                  </View>
                  <View style={s.sizeRow}>
                    {[3,6,10,16,24].map((sz) => (
                      <Pressable key={sz} onPress={() => handleDrawSize(sz)} style={[s.sizeBtn, drawSize === sz && s.sizeBtnOn]}>
                        <View style={{ width: sz, height: sz, borderRadius: sz/2, backgroundColor: drawColor === "#FFFFFF" ? "#000" : drawColor }} />
                      </Pressable>
                    ))}
                    <Pressable onPress={() => { cmd({ clearDraw: true }); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} style={s.clearDrawBtn}>
                      <Ionicons name="trash-outline" size={16} color={Colors.error} />
                    </Pressable>
                  </View>
                </View>
              )}

              {activeTab === "text" && (
                <View style={s.textPanel}>
                  <Pressable onPress={() => setShowTextModal(true)} style={s.addTextBtn}>
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={s.addTextBtnLabel}>Add Text</Text>
                  </Pressable>
                  <Text style={s.panelLabel}>Text Color</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                    {["#FFFFFF","#000000","#EF4444","#F97316","#EAB308","#22C55E","#3B82F6","#8B5CF6","#EC4899","#06B6D4"].map((c) => (
                      <Pressable key={c} onPress={() => setTextColor(c)} style={[s.colorDot, { backgroundColor: c, borderWidth: textColor === c ? 3 : 1.5, borderColor: textColor === c ? ACCENT : "rgba(0,0,0,0.15)" }]} />
                    ))}
                  </ScrollView>
                  <View style={s.textMeta}>
                    <Text style={s.panelLabel}>Size: {textSize}px</Text>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {[28,36,42,52,64].map((sz) => (
                        <Pressable key={sz} onPress={() => setTextSize(sz)} style={[s.sizeTagBtn, textSize === sz && s.sizeTagBtnOn]}>
                          <Text style={[s.sizeTagText, textSize === sz && { color: ACCENT }]}>{sz}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Pressable onPress={() => setTextBold(!textBold)} style={[s.boldBtn, textBold && s.boldBtnOn]}>
                      <Text style={[s.boldBtnText, textBold && { color: ACCENT }]}>B</Text>
                    </Pressable>
                  </View>
                  <Text style={s.panelHint}>After adding, drag text to reposition</Text>
                </View>
              )}

              {activeTab === "sticker" && (
                <ScrollView contentContainerStyle={s.stickerGrid} showsVerticalScrollIndicator={false}>
                  {STICKERS.map((emoji) => (
                    <Pressable key={emoji} onPress={() => addSticker(emoji)} style={s.stickerBtn}>
                      <Text style={s.stickerEmoji}>{emoji}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              {activeTab === "adjust" && (
                <ScrollView contentContainerStyle={s.adjustPanel} showsVerticalScrollIndicator={false}>
                  <MiniSlider label="Saturation" value={saturation} min={0} max={250} color="#EC4899" icon="color-palette-outline" onChange={applySaturation} />
                  <MiniSlider label="Exposure" value={exposure + 100} min={0} max={200} color="#F59E0B" icon="aperture-outline" onChange={(v) => applyExposure(v - 100)} />
                  <View style={s.transformRow}>
                    <Text style={s.panelLabel}>Transform</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {[
                        { icon: "rotate-left", label: "↺", action: () => cmd({ rotate: -90 }) },
                        { icon: "rotate-right", label: "↻", action: () => cmd({ rotate: 90 }) },
                        { icon: "swap-horizontal-outline", label: "⇔", action: () => cmd({ flipH: true }) },
                        { icon: "swap-vertical-outline", label: "⇕", action: () => cmd({ flipV: true }) },
                      ].map((b) => (
                        <Pressable key={b.label} onPress={() => { b.action(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} style={s.transformBtn}>
                          <Ionicons name={b.icon as any} size={20} color={Colors.text} />
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <Pressable onPress={pickImage} style={s.changePhotoBtn}>
                    <Ionicons name="images-outline" size={16} color={ACCENT} />
                    <Text style={s.changePhotoBtnText}>Change Photo</Text>
                  </Pressable>
                </ScrollView>
              )}
            </View>

            {/* ── Tab bar ── */}
            <View style={s.tabBar}>
              {TABS.map((tab) => (
                <Pressable key={tab.id} onPress={() => onTabPress(tab.id)} style={s.tabItem}>
                  <View style={[s.tabIconWrap, activeTab === tab.id && { backgroundColor: ACCENT + "20" }]}>
                    <Ionicons name={tab.icon as any} size={20} color={activeTab === tab.id ? ACCENT : Colors.textMuted} />
                  </View>
                  <Text style={[s.tabLabel, activeTab === tab.id && { color: ACCENT }]}>{tab.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* ── Text Modal ── */}
      <Modal visible={showTextModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <Pressable style={s.modalBg} onPress={() => setShowTextModal(false)} />
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Add Text</Text>
            <TextInput
              style={s.textInputBox}
              placeholder="Type your text…"
              placeholderTextColor={Colors.textMuted}
              value={textInput}
              onChangeText={setTextInput}
              autoFocus
              multiline
              maxLength={80}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable onPress={() => setShowTextModal(false)} style={s.modalCancelBtn}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={addText} style={[s.modalAddBtn, !textInput.trim() && { opacity: 0.5 }]} disabled={!textInput.trim()}>
                <Text style={s.modalAddText}>Add to Photo</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Mini Slider ────────────────────────────────────────────────────────────────
function MiniSlider({ label, value, min, max, color, icon, onChange }: {
  label: string; value: number; min: number; max: number;
  color: string; icon: string; onChange: (v: number) => void;
}) {
  const { width: SW } = useWindowDimensions();
  const TRACK = SW - 32 - 80 - 48;
  const pct = (value - min) / (max - min);
  const onPress = (e: any) => {
    const x = e.nativeEvent.locationX;
    const newPct = Math.max(0, Math.min(1, x / TRACK));
    const newVal = Math.round(min + newPct * (max - min));
    onChange(newVal);
    Haptics.selectionAsync();
  };
  return (
    <View style={s.sliderRow}>
      <Ionicons name={icon as any} size={15} color={color} />
      <Text style={s.sliderLabel}>{label}</Text>
      <Pressable onPress={onPress} style={[s.track, { width: TRACK }]}>
        <View style={[s.fill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
        <View style={[s.thumb, { left: `${Math.max(0, pct * 100 - 1.5)}%` as any }]} />
      </Pressable>
      <Text style={s.sliderVal}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  topBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.separator, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: Colors.cardBorder },

  // Empty state
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 14, position: "relative" },
  emptyGlow: { position: "absolute", top: "20%", width: 260, height: 260, borderRadius: 130, backgroundColor: ACCENT, opacity: 0.05 },
  emptyIconWrap: { width: 120, height: 120, borderRadius: 36, backgroundColor: ACCENT + "15", justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: ACCENT + "40" },
  emptyTitle: { fontFamily: "Poppins_700Bold", fontSize: 22, color: Colors.text, letterSpacing: -0.3 },
  emptyDesc: { fontFamily: "Poppins_400Regular", fontSize: 13.5, color: Colors.textSecondary, textAlign: "center", lineHeight: 21, maxWidth: 300 },
  featureRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  featureChip: { backgroundColor: ACCENT + "12", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: ACCENT + "30" },
  featureChipText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: ACCENT },
  pickBtn: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: ACCENT, borderRadius: 16, paddingVertical: 15, shadowColor: ACCENT, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 },
  pickBtnOutline: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: ACCENT + "10", borderRadius: 16, paddingVertical: 14, borderWidth: 1.5, borderColor: ACCENT + "40" },
  pickBtnText: { fontFamily: "Poppins_700Bold", fontSize: 15, color: "#fff" },

  // Canvas
  canvas: { flex: 1, backgroundColor: "#0A0A14" },

  // Toolbar
  toolbar: { backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.cardBorder },
  tabContent: { minHeight: 130 },

  // Filters
  filterRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  filterChip: { alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: Colors.separator, borderWidth: 1.5, borderColor: Colors.cardBorder },
  filterChipOn: { backgroundColor: ACCENT + "15", borderColor: ACCENT },
  filterEmoji: { fontSize: 20 },
  filterLabel: { fontFamily: "Poppins_500Medium", fontSize: 10, color: Colors.textSecondary },
  filterLabelOn: { color: ACCENT },

  // Sliders
  sliderSection: { paddingHorizontal: 16, gap: 8, paddingBottom: 6 },
  sliderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sliderLabel: { fontFamily: "Poppins_500Medium", fontSize: 11, color: Colors.text, width: 72 },
  track: { height: 5, backgroundColor: Colors.separator, borderRadius: 5, position: "relative" },
  fill: { position: "absolute", left: 0, top: 0, height: 5, borderRadius: 5 },
  thumb: { position: "absolute", top: -8, width: 21, height: 21, borderRadius: 10.5, backgroundColor: Colors.white, borderWidth: 2.5, borderColor: Colors.primary, marginLeft: -10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4, elevation: 4 },
  sliderVal: { fontFamily: "Poppins_600SemiBold", fontSize: 11, color: Colors.textMuted, width: 30, textAlign: "right" },

  // Draw panel
  drawPanel: { padding: 12, gap: 8 },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  sizeLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  sizeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sizeBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.separator, justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: Colors.cardBorder },
  sizeBtnOn: { borderColor: ACCENT, backgroundColor: ACCENT + "15" },
  clearDrawBtn: { marginLeft: "auto" as any, width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.error + "12", justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: Colors.error + "30" },

  // Text panel
  textPanel: { padding: 12, gap: 8 },
  addTextBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 10 },
  addTextBtnLabel: { fontFamily: "Poppins_700Bold", fontSize: 14, color: "#fff" },
  textMeta: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  sizeTagBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: Colors.separator, borderWidth: 1, borderColor: Colors.cardBorder },
  sizeTagBtnOn: { backgroundColor: ACCENT + "15", borderColor: ACCENT },
  sizeTagText: { fontFamily: "Poppins_600SemiBold", fontSize: 11, color: Colors.textSecondary },
  boldBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: Colors.separator, borderWidth: 1, borderColor: Colors.cardBorder },
  boldBtnOn: { backgroundColor: ACCENT + "15", borderColor: ACCENT },
  boldBtnText: { fontFamily: "Poppins_700Bold", fontSize: 13, color: Colors.textSecondary },
  panelHint: { fontFamily: "Poppins_400Regular", fontSize: 10.5, color: Colors.textMuted, textAlign: "center" },

  // Stickers
  stickerGrid: { flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 6, justifyContent: "space-around" },
  stickerBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.separator, justifyContent: "center", alignItems: "center" },
  stickerEmoji: { fontSize: 26 },

  // Adjust
  adjustPanel: { padding: 12, gap: 10 },
  transformRow: { gap: 8 },
  transformBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.separator, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: Colors.cardBorder },
  changePhotoBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: ACCENT + "40", backgroundColor: ACCENT + "08", marginTop: 4 },
  changePhotoBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: ACCENT },

  // Tab bar
  tabBar: { flexDirection: "row", paddingTop: 8, borderTopWidth: 0.5, borderTopColor: Colors.cardBorder, paddingHorizontal: 4 },
  tabItem: { flex: 1, alignItems: "center", gap: 2 },
  tabIconWrap: { width: 40, height: 32, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  tabLabel: { fontFamily: "Poppins_500Medium", fontSize: 9.5, color: Colors.textMuted },

  // Shared panel label
  panelLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 11, color: Colors.textSecondary },

  // Text Modal
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.cardBorder, alignSelf: "center" },
  modalTitle: { fontFamily: "Poppins_700Bold", fontSize: 18, color: Colors.text },
  textInputBox: { backgroundColor: Colors.separator, borderRadius: 14, padding: 14, fontFamily: "Poppins_400Regular", fontSize: 16, color: Colors.text, minHeight: 80, borderWidth: 1, borderColor: Colors.cardBorder },
  modalCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: Colors.separator, alignItems: "center", borderWidth: 1, borderColor: Colors.cardBorder },
  modalCancelText: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: Colors.textSecondary },
  modalAddBtn: { flex: 2, paddingVertical: 13, borderRadius: 14, backgroundColor: ACCENT, alignItems: "center" },
  modalAddText: { fontFamily: "Poppins_700Bold", fontSize: 14, color: "#fff" },
});
