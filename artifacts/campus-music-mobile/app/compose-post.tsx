import { Ionicons } from "@/components/icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { createPost } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

export default function ComposePostScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { quotePostId } = useLocalSearchParams<{ quotePostId?: string }>();
  const [body, setBody] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  const isQuote = typeof quotePostId === "string" && !!quotePostId;
  const canPost = body.trim().length > 0 && !isPosting;

  const handlePost = async () => {
    if (!canPost) return;
    setIsPosting(true);
    try {
      await createPost({
        body: body.trim(),
        ...(isQuote ? { type: "quote" as const, originalPostId: quotePostId } : {}),
      });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      router.back();
    } catch {
      setIsPosting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8, borderColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={[styles.cancel, { color: colors.mutedForeground }]}>Cancel</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>{isQuote ? "Quote" : "New post"}</Text>
        <Pressable
          onPress={handlePost}
          disabled={!canPost}
          style={[styles.postBtn, { backgroundColor: canPost ? colors.primary : colors.muted }]}
        >
          {isPosting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={[styles.postBtnText, { color: canPost ? "#fff" : colors.mutedForeground }]}>Post</Text>
          )}
        </Pressable>
      </View>

      <TextInput
        style={[styles.input, { color: colors.foreground }]}
        placeholder="What's happening on campus?"
        placeholderTextColor={colors.mutedForeground}
        value={body}
        onChangeText={setBody}
        multiline
        autoFocus
        maxLength={2000}
      />

      <View style={styles.toolbar}>
        <Ionicons name="musical-notes-outline" size={22} color={colors.mutedForeground} />
        <Ionicons name="image-outline" size={22} color={colors.mutedForeground} />
        <Text style={[styles.counter, { color: colors.mutedForeground }]}>{2000 - body.length}</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  cancel: { fontSize: 16 },
  title: { fontSize: 17, fontWeight: "700" },
  postBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 18 },
  postBtnText: { fontSize: 15, fontWeight: "700" },
  input: { flex: 1, fontSize: 17, lineHeight: 24, padding: 16, textAlignVertical: "top" },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  counter: { marginLeft: "auto", fontSize: 13 },
});
