import { Ionicons } from "@/components/icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Track } from "@/components/MusicCard";
import { useColors } from "@/hooks/useColors";

interface TrackMenuProps {
  track: Track | null;
  visible: boolean;
  onClose: () => void;
  onPlayNext: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
}

export function TrackMenu({ track, visible, onClose, onPlayNext, onAddToQueue }: TrackMenuProps) {
  const colors = useColors();

  if (!track) return null;

  const handlePlayNext = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPlayNext(track);
    onClose();
  };

  const handleAddToQueue = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAddToQueue(track);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Track info */}
          <View style={styles.trackInfo}>
            <View style={[styles.colorDot, { backgroundColor: track.coverColor }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.trackTitle, { color: colors.foreground }]} numberOfLines={1}>
                {track.title}
              </Text>
              <Text style={[styles.trackArtist, { color: colors.mutedForeground }]} numberOfLines={1}>
                {track.artist}
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Actions */}
          <Pressable style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.7 }]} onPress={handlePlayNext}>
            <View style={[styles.menuIcon, { backgroundColor: colors.primary + "20" }]}>
              <Ionicons name="play-skip-forward" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuLabel, { color: colors.foreground }]}>Play Next</Text>
              <Text style={[styles.menuSub, { color: colors.mutedForeground }]}>Play after current song</Text>
            </View>
          </Pressable>

          <Pressable style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.7 }]} onPress={handleAddToQueue}>
            <View style={[styles.menuIcon, { backgroundColor: colors.primary + "20" }]}>
              <Ionicons name="list" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuLabel, { color: colors.foreground }]}>Add to Queue</Text>
              <Text style={[styles.menuSub, { color: colors.mutedForeground }]}>Add to end of queue</Text>
            </View>
          </Pressable>

          {/* Cancel */}
          <Pressable
            style={({ pressed }) => [styles.cancelBtn, { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 }]}
            onPress={onClose}
          >
            <Text style={[styles.cancelText, { color: colors.foreground }]}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  trackInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  colorDot: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  trackArtist: {
    fontSize: 13,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 14,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  menuSub: {
    fontSize: 12,
  },
  cancelBtn: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
