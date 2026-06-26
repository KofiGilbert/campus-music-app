import { Ionicons } from "@/components/icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { Post } from "@workspace/api-client-react";
import { togglePostLike, repost as repostApi, unrepost, sharePost } from "@workspace/api-client-react";
import { RichText } from "@/components/RichText";
import { usePlayer } from "@/context/PlayerContext";
import { useColors } from "@/hooks/useColors";

function initials(name?: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** A single post in the feed: author, body (linkified), attached track, image,
 * embedded original (for reposts/quotes), and the engagement bar. */
export function PostCard({ post }: { post: Post }) {
  const colors = useColors();
  const { playTrack } = usePlayer();

  const [liked, setLiked] = useState(!!post.hasLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [reposted, setReposted] = useState(!!post.hasReposted);
  const [repostCount, setRepostCount] = useState(post.repostCount);
  const [shareCount, setShareCount] = useState(post.shareCount);

  // For a repost, the meaningful content is the original post.
  const content = post.type === "repost" && post.originalPost ? post.originalPost : post;
  const author = content.author;
  const track = content.attachedTrack;

  const onLike = async () => {
    setLiked((v) => !v);
    setLikeCount((c) => c + (liked ? -1 : 1));
    try {
      const res = await togglePostLike(content.id);
      setLiked(res.liked);
      setLikeCount(res.likeCount);
    } catch {
      setLiked((v) => !v);
      setLikeCount((c) => c + (liked ? 1 : -1));
    }
  };

  const onRepost = async () => {
    try {
      if (reposted) {
        await unrepost(content.id);
        setReposted(false);
        setRepostCount((c) => Math.max(0, c - 1));
      } else {
        await repostApi(content.id);
        setReposted(true);
        setRepostCount((c) => c + 1);
      }
    } catch {
      /* keep current state */
    }
  };

  const onShare = async () => {
    try {
      const res = await sharePost(content.id, { platform: "copy_link" });
      setShareCount(res.shareCount);
    } catch {
      /* ignore */
    }
  };

  const onPlay = () => {
    if (!track) return;
    playTrack({
      id: track.id,
      title: track.title,
      artist: track.artist,
      genre: track.genre,
      duration: track.duration,
      coverColor: track.coverColor,
      liked: false,
      audioUrl: track.audioUrl,
      audioUrls: track.audioUrls ?? null,
      coverUrl: track.coverUrl,
      processingStatus: track.processingStatus,
      durationSeconds: track.durationSeconds,
    });
  };

  return (
    <Pressable
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/post/${post.id}`)}
    >
      {post.type === "repost" && (
        <View style={styles.repostTag}>
          <Ionicons name="repeat" size={13} color={colors.mutedForeground} />
          <Text style={[styles.repostText, { color: colors.mutedForeground }]}>
            {post.author?.name ?? "Someone"} reposted
          </Text>
        </View>
      )}

      <View style={styles.header}>
        <Pressable
          onPress={() => author && router.push(`/profile/${author.id}`)}
          style={[styles.avatar, { backgroundColor: colors.primary }]}
        >
          {author?.avatarUrl ? (
            <Image source={{ uri: author.avatarUrl }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarInitials}>{initials(author?.name)}</Text>
          )}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {author?.name ?? "Unknown"}
          </Text>
          <Text style={[styles.handle, { color: colors.mutedForeground }]} numberOfLines={1}>
            @{author?.username ?? "user"}
          </Text>
        </View>
      </View>

      {!!content.body && (
        <RichText
          body={content.body}
          linkColor={colors.primary}
          style={[styles.body, { color: colors.foreground }]}
        />
      )}

      {content.attachedImageUrl ? (
        <Image source={{ uri: content.attachedImageUrl }} style={styles.postImage} resizeMode="cover" />
      ) : null}

      {track ? (
        <Pressable
          onPress={onPlay}
          style={[styles.trackRow, { backgroundColor: colors.background, borderColor: colors.border }]}
        >
          <View style={[styles.trackCover, { backgroundColor: track.coverColor }]}>
            <Ionicons name="play" size={18} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.trackTitle, { color: colors.foreground }]} numberOfLines={1}>
              {track.title}
            </Text>
            <Text style={[styles.trackArtist, { color: colors.mutedForeground }]} numberOfLines={1}>
              {track.artist}
              {track.processingStatus && track.processingStatus !== "ready" ? " · Processing…" : ""}
            </Text>
          </View>
        </Pressable>
      ) : null}

      <View style={styles.actions}>
        <Pressable style={styles.action} onPress={onLike} hitSlop={8}>
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={20}
            color={liked ? "#e0245e" : colors.mutedForeground}
          />
          <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>{likeCount}</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={() => router.push(`/post/${post.id}`)} hitSlop={8}>
          <Ionicons name="chatbubble-outline" size={19} color={colors.mutedForeground} />
          <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>{content.commentCount}</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={onRepost} hitSlop={8}>
          <Ionicons name="repeat" size={20} color={reposted ? "#17bf63" : colors.mutedForeground} />
          <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>{repostCount}</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={onShare} hitSlop={8}>
          <Ionicons name="share-outline" size={19} color={colors.mutedForeground} />
          <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>{shareCount}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  repostTag: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  repostText: { fontSize: 12, fontWeight: "600" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: 40, height: 40 },
  avatarInitials: { color: "#fff", fontWeight: "700", fontSize: 14 },
  name: { fontSize: 15, fontWeight: "700" },
  handle: { fontSize: 13 },
  body: { fontSize: 15, lineHeight: 21, marginBottom: 10 },
  postImage: { width: "100%", height: 200, borderRadius: 12, marginBottom: 10 },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
  },
  trackCover: { width: 44, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  trackTitle: { fontSize: 14, fontWeight: "600" },
  trackArtist: { fontSize: 12 },
  actions: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8 },
  action: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionCount: { fontSize: 13 },
});
