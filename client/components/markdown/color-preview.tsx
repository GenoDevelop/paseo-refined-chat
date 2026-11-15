import React, { createContext, useContext, useState } from "react";
import { Modal, View, Text, Pressable } from "react-native";
import { copyText } from "@getpaseo/plugin/client/ui";
import type { ExtendedThemeTokens } from "../theme-tokens";
import { hexMatches, hexChannels } from "./hex-color";
const ColorContext = createContext<((hex: string) => void) | null>(null);
export function ColorPreview({ tokens, children }: { tokens: ExtendedThemeTokens; children: React.ReactNode }) {
  const [hex, setHex] = useState<string | null>(null), [status, setStatus] = useState("");
  const c = hex ? hexChannels(hex) : null;
  return <ColorContext.Provider value={value => { setStatus(""); setHex(value); }}>
    {children}
    {hex && c && <Modal visible transparent animationType="fade" onRequestClose={() => setHex(null)}>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.6)" }}>
        <Pressable accessibilityLabel="Close color preview" onPress={() => setHex(null)} style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }} />
        <View accessibilityViewIsModal style={{ width: "100%", maxWidth: 460, padding: 20, gap: 14, borderRadius: 14, backgroundColor: tokens.surface0 }}>
          <Text selectable style={{ color: tokens.foreground, fontSize: 20 }}>{hex}</Text>
          <View style={{ height: 220, borderRadius: 8, overflow: "hidden" }}>
            {Array.from({ length: 11 }, (_, row) => <View key={row} style={{ flex: 1, flexDirection: "row" }}>{Array.from({ length: 24 }, (_, col) => <View key={col} style={{ flex: 1, backgroundColor: (row + col) % 2 ? "#aaa" : "#fff" }} />)}</View>)}
            <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: hex }} />
          </View>
          <Text selectable style={{ color: tokens.foreground }}>RGB: {c.r}, {c.g}, {c.b} · Alpha: {Math.round(c.alpha * 100)}%</Text>
          <Text selectable style={{ color: tokens.foreground }}>HSL: {c.h}°, {c.s}%, {c.l}%</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Pressable accessibilityRole="button" onPress={() => void copyText(hex).then(() => setStatus("Copied"), () => setStatus("Copy unavailable"))}><Text style={{ color: tokens.foreground }}>{status || "Copy HEX"}</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => setHex(null)}><Text style={{ color: tokens.foreground }}>Close</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>}
  </ColorContext.Provider>;
}
export function ColorText({ text, prefix = "" }: { text: string; prefix?: string }) {
  const open = useContext(ColorContext), matches = hexMatches(text, prefix);
  if (!open || !matches.length) return <>{text}</>;
  const parts: React.ReactNode[] = []; let end = 0;
  for (const match of matches) {
    parts.push(text.slice(end, match.index), match.hex,
      <Text key={match.index} accessibilityRole="button" accessibilityLabel={`Preview color ${match.hex}`} onPress={() => open(match.hex)} style={{ color: match.hex, textShadowColor: "#888", textShadowRadius: 1 }}> {"\u25a0"}</Text>);
    end = match.index + match.hex.length;
  }
  parts.push(text.slice(end)); return <>{parts}</>;
}
