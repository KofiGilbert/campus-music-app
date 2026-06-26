import { Ionicons } from "@/components/icons";
import { PostCard } from "@/components/PostCard";
import { RichText } from "@/components/RichText";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import type { Comment } from "@workspace/api-client-react";
import { createComment, createFlag, getComments, getPost, toggleCommentLike } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function CommentItem({
  comment,
  onReply,
  depth = 0,
}: {
  comment: Comment;
  onReply: (c: Comment) => void;
  depth?: number;
}) {
  const colors = useColors();
  const [liked, setLiked] = useState(!!comment.hasLiked);
  const [likeCount, setLikeCount] = useState(comment.likeCount);

  const onLike = async () => {
    setLiked((v) => !v);
    setLikeCount((c) => c + (liked ? -1 : 1));
    try {
      const res = await toggleCommentLike(comment.id);
      setLiked(res.liked);
      setLikeCount(res.likeCount);
    } catch {
      setLiked((v) => !v);
      setLikeCount((c) => c + (liked ? 1 : -1));
    }
  };

  return (
    <View style={[styles.comment, depth > 0 && { marginLeft: 28 }]}>
      <View style={styles.commentHead}>
        <Text style={[styles.commentName, { color: colors.foreground }]}>{comment.author?.name ?? "Unknown"}</Text>
        <Text style={[styles.commentMeta, { color: colors.mutedForeground }]}>
          @{comment.author?.username ?? "user"} · {timeAgo(comment.createdAt)}
        </Text>
      </View>
      <RichText body={comment.body} linkColor={colors.primary} style={[styles.commentBody, { color: colors.foreground }]} />
      <View style={styles.commentActions}>
        <Pressable style={styles.commentAction} onPress={onLike} hitSlop={8}>
          <Ionicons name={liked ? "heart" : "heart-outline"} size={15} color={liked ? "#e0245e" : colors.mutedForeground} />
          {likeCount > 0 && <Text style={[styles.commentActionText, { color: colors.mutedForeground }]}>{likeCount}</Text>}
        </Pressable>
        {depth === 0 && (
          <Pressable onPress={() => onReply(comment)} hitSlop={8}>
            <Text style={[styles.commentActionText, { color: colors.mutedForeground }]}>Reply</Text>
          </Pressable>
        )}
      </View>
      {comment.replies?.map((r) => (
        <CommentItem key={r.id} comment={r} onReply={onReply} depth={depth + 1} />
      ))}
    </View>
  );
}

export default function PostDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [sending, setSending] = useState(false);

  const postQuery = useQuery({
    queryKey: ["post", id],
    queryFn: () => getPost(id as string),
    enabled: !!id,
  });

  const commentsQuery = useQuery({
    queryKey: ["comments", "post", id],
    queryFn: () => getComments({ targetType: "post", targetId: id as string }),
    enabled: !!id,
  });

  const handleSend = async () => {
    const value = text.trim();
    if (!value || sending || !id) return;
    setSending(true);
    try {
      await createComment({
        targetType: "post",
        targetId: id,
        body: value,
        ...(replyTo ? { parentCommentId: replyTo.id } : {}),
      });
      setText("");
      setReplyTo(null);
      await commentsQuery.refetch();
      await postQuery.refetch();
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.topbar, { paddingTop: insets.top + 8, borderColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.foreground }]}>Post</Text>
        <Pressable
          onPress={() => {
            if (!id) return;
            void createFlag({ targetType: "post", targetId: id }).then(() =>
              Alert.alert("Reported", "Thanks — our team will review this post."),
            );
          }}
          hitSlop={10}
        >
          <Ionicons name="alert-circle-outline" size={22} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <FlatList
        data={commentsQuery.data?.items ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        ListHeaderComponent={
          postQuery.data ? (
            <View style={{ marginBottom: 12 }}>
              <PostCard post={postQuery.data} />
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Comments</Text>
            </View>
          ) : (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
          )
        }
        ListEmptyComponent={
          postQuery.data && !commentsQuery.isLoading ? (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>No comments yet. Be the first.</Text>
          ) : null
        }
        renderItem={({ item }) => <CommentItem comment={item} onReply={setReplyTo} />}
      />

      <View style={[styles.composer, { borderColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
        {replyTo && (
          <View style={styles.replyChip}>
            <Text style={[styles.replyChipText, { color: colors.mutedForeground }]}>
              Replying to @{replyTo.author?.username ?? "user"}
            </Text>
            <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
              <Ionicons name="close" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
        )}
        <View style={styles.composerRow}>
          <TextInput
            style={[styles.composerInput, { color: colors.foreground, backgroundColor: colors.muted }]}
            placeholder="Add a comment…"
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={1000}
          />
          <Pressable onPress={handleSend} disabled={!text.trim() || sending} hitSlop={8}>
            {sending ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Ionicons name="send" size={22} color={text.trim() ? colors.primary : colors.mutedForeground} />
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  topTitle: { fontSize: 17, fontWeight: "700" },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 8 },
  empty: { textAlign: "center", marginTop: 24, fontSize: 14 },
  comment: { marginTop: 14 },
  commentHead: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  commentName: { fontSize: 14, fontWeight: "700" },
  commentMeta: { fontSize: 12 },
  commentBody: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  commentActions: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 4 },
  commentAction: { flexDirection: "row", alignItems: "center", gap: 4 },
  commentActionText: { fontSize: 12, fontWeight: "600" },
  composer: { borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 8 },
  replyChip: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  replyChipText: { fontSize: 12 },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  composerInput: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
    maxHeight: 100,
  },
});
