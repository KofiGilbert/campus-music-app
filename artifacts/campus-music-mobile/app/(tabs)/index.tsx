import { Ionicons } from "@/components/icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useRouter } from "expo-router";
import React, { useState, useEffect, useRef } from "react";
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { getAlbumArtUrl } from "@/utils/albumArt";
import { TrackCover } from "@/components/TrackCover";
import { resizeCoverUrl } from "@/utils/coverUrl";
import { colorToBlurhash } from "@/utils/blurhash";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { getFeed, getArtists } from "@workspace/api-client-react";
import { NowPlayingBar } from "@/components/NowPlayingBar";
import { EcosystemDrawer } from "@/components/EcosystemDrawer";
import { ResumePromptBanner } from "@/components/ResumePromptBanner";
import { useAuth } from "@/context/AuthContext";
import { usePlayer } from "@/context/PlayerContext";
import { useColors } from "@/hooks/useColors";

// ─── Seed live artists ────────────────────────────────────────────────────────
const LIVE_ARTISTS = [
  { id: "a9", initials: "HH", name: "Hip Hop Collective", color: "#f97316", viewers: 1200, live: true, genre: "Hip Hop",
    photo: "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800&q=90&fit=crop" },
  { id: "a5", initials: "RS", name: "R&B Society", color: "#10b981", viewers: 198, live: true, genre: "R&B",
    photo: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&q=90&fit=crop" },
  { id: "a6", initials: "LC", name: "Lo-Fi Club", color: "#6366f1", viewers: 870, live: true, genre: "Lo-Fi",
    photo: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&q=90&fit=crop" },
  { id: "a10", initials: "AL", name: "Ambient Lab", color: "#0ea5e9", viewers: 5400, live: true, genre: "Ambient",
    photo: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=90&fit=crop" },
  { id: "a1", initials: "CC", name: "Campus Collective", color: "#e85d4a", viewers: 23, live: false, genre: "Indie",
    photo: "https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=800&q=90&fit=crop" },
  { id: "a7", initials: "SW", name: "Synth Wave", color: "#ec4899", viewers: 760, live: true, genre: "Electronic",
    photo: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=90&fit=crop" },
];

const POST_CATEGORIES: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  "Behind the scenes": { icon: "camera-outline", color: "#e85d4a" },
  "New Release": { icon: "musical-notes-outline", color: "#8b5cf6" },
  "Live Session": { icon: "radio-outline", color: "#10b981" },
  "Studio Update": { icon: "mic-outline", color: "#f59e0b" },
  "Collab Drop": { icon: "people-outline", color: "#3b82f6" },
  "Campus Event": { icon: "school-outline", color: "#ec4899" },
};

type FeedTab = "live" | "latest" | "trending";

// ─── Seed comments for post cards ─────────────────────────────────────────────
const POST_COMMENT_POOL = [
  ["This is insane 🔥", "How long did this take to make?", "The bridge is everything", "Can't stop replaying this", "Okay this actually slaps", "Someone send this to SoundCloud", "The flow is immaculate fr", "Bro dropped a whole masterpiece", "Late night walk energy 🌙", "My roommate is obsessed with this"],
  ["Dropping at the perfect time", "This needs to be on the main playlist", "The mix on this is clean af", "Studio vibes are unmatched", "Saw you perform this at the quad!", "Give us an album already 🙏", "First listen and I already know every word", "This is why I came to this school", "The hook is stuck in my head", "Production is crazy good"],
  ["One of the best things I've heard this semester", "The outro gave me chills no cap", "Low key crying to this at 2am", "College artists are on a different level", "You need more recognition fr", "Shared this with the whole group chat", "This sounds like a top 40 hit", "How are you not signed yet??", "The vibe shift at 1:30 is unreal", "Campus music is evolving 💯"],
];
const POST_COMMENTER_NAMES = ["Alex", "Jordan", "Mia", "DeShawn", "Priya", "Kofi", "Sofia", "Liam", "Amara", "Tyler"];
const POST_COMMENTER_COLORS = ["#e85d4a", "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899"];
const POST_COMMENTER_PHOTOS: Record<string, string> = {
  Alex:    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&q=80&fit=crop&crop=face",
  Jordan:  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=160&q=80&fit=crop&crop=face",
  Mia:     "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=160&q=80&fit=crop&crop=face",
  DeShawn: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&q=80&fit=crop&crop=face",
  Priya:   "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=160&q=80&fit=crop&crop=face",
  Kofi:    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=160&q=80&fit=crop&crop=face",
  Sofia:   "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=160&q=80&fit=crop&crop=face",
  Liam:    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=160&q=80&fit=crop&crop=face",
  Amara:   "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=160&q=80&fit=crop&crop=face",
  Tyler:   "https://images.unsplash.com/photo-1488161628813-04466f872be2?w=160&q=80&fit=crop&crop=face",
};

type PostReply = { id: string; name: string; photo: string; color: string; text: string; time: string; };
type PostComment = {
  id: string; name: string; photo: string; color: string;
  text: string; likes: number; time: string; replies: PostReply[];
};

function seedComments(postId: string): PostComment[] {
  const hash = postId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const pool = POST_COMMENT_POOL[hash % POST_COMMENT_POOL.length];
  return pool.map((text, i) => {
    const name = POST_COMMENTER_NAMES[(hash + i) % POST_COMMENTER_NAMES.length];
    return {
      id: `${postId}-${i}`,
      name,
      photo: POST_COMMENTER_PHOTOS[name] ?? "",
      color: POST_COMMENTER_COLORS[(hash + i) % POST_COMMENTER_COLORS.length],
      text,
      likes: (hash * 3 + i * 7 + 4) % 180 + 3,
      time: `${[1, 3, 6, 11, 17, 24, 33, 42, 55, 68][i % 10]}m`,
      replies: [],
    };
  });
}

// ─── Pulsing dot ──────────────────────────────────────────────────────────────
function PulsingDot() {
  const pulse = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.6, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <View style={{ width: 14, height: 14, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute",
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: "#e85d4a",
          opacity,
          transform: [{ scale: pulse }],
        }}
      />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#e85d4a" }} />
    </View>
  );
}

// ─── Format viewer count ───────────────────────────────────────────────────────
function fmtViewers(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ─── Live artist chip ─────────────────────────────────────────────────────────
function LiveChip({ artist }: { artist: (typeof LIVE_ARTISTS)[0] }) {
  const colors = useColors();
  const router = useRouter();
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!artist.live) return;
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(ringScale, { toValue: 1.18, duration: 900, useNativeDriver: true }),
          Animated.timing(ringScale, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(ringOpacity, { toValue: 0.15, duration: 900, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.6, duration: 900, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, [artist.live]);

  return (
    <Pressable
      style={styles.liveChipWrap}
      onPress={() => {
        if (!artist.live) return;
        router.push({
          pathname: "/live",
          params: {
            id: artist.id,
            name: artist.name,
            color: artist.color,
            photo: artist.photo,
            genre: artist.genre,
            viewers: String(artist.viewers),
          },
        });
      }}
    >
      {/* Avatar + animated ring */}
      <View style={styles.liveChipCircleWrap}>
        {artist.live && (
          <Animated.View
            style={[
              styles.liveRing,
              { borderColor: artist.color, opacity: ringOpacity, transform: [{ scale: ringScale }] },
            ]}
          />
        )}
        <TrackCover
          coverUrl={artist.photo}
          coverColor={artist.color}
          size={50}
          thumbSize={100}
          circular
          iconSize={0}
        />
        {/* viewer count badge */}
        {artist.live && (
          <View style={[styles.liveBadge, { backgroundColor: "#e85d4a" }]}>
            <Ionicons name="eye" size={8} color="#fff" />
            <Text style={styles.liveBadgeText}>{fmtViewers(artist.viewers)}</Text>
          </View>
        )}
      </View>

      {/* Name */}
      <Text style={[styles.liveChipName, { color: colors.foreground }]} numberOfLines={1}>
        {artist.name}
      </Text>
    </Pressable>
  );
}

// ─── Post card ────────────────────────────────────────────────────────────────
interface Post {
  id: string;
  artist: string;
  handle: string;
  avatar: string;
  avatarUrl?: string | null;
  time: string;
  category: string;
  body: string;
  likes: number;
  comments: number;
  reposts: number;
  shares: number;
  saves: number;
  albumColor: string;
  albumArtUrl: string;
  trackTitle: string;
  trackGenre: string;
  playCount: number;
  trackCoverUrl?: string | null;
  trackCoverColor?: string;
}

// ── Album art card ────────────────────────────────────────────────────────────
function AlbumArtCard({ post, onPlay }: { post: Post; onPlay: () => void }) {
  const uri = resizeCoverUrl(post.albumArtUrl, 1000);
  const blurhash = colorToBlurhash(post.albumColor);

  return (
    <Pressable style={styles.albumCardWrap} onPress={onPlay}>
      <View style={styles.albumCard}>
        {/* Background image via expo-image for caching + placeholder */}
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, styles.albumCardImage]}
          contentFit="cover"
          placeholder={{ blurhash }}
          transition={200}
          cachePolicy="memory-disk"
        />

        {/* Subtle dark overlay so gradient reads well */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.albumDarkOverlay} />
        </View>

        {/* Top-left genre pill */}
        <View style={styles.albumGenrePill}>
          <Ionicons name="musical-notes" size={11} color="#fff" />
          <Text style={styles.albumGenreText}>{post.trackGenre}</Text>
        </View>

        {/* Centre play button */}
        <View style={styles.albumCenterPlay}>
          <View style={styles.albumPlayBtnBg}>
            <Ionicons name="play" size={32} color="#fff" style={{ marginLeft: 4 }} />
          </View>
        </View>

        {/* Bottom gradient + track info */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.85)"]}
          style={styles.albumGradient}
        >
          <View style={styles.albumInfo}>
            <View style={{ flex: 1 }}>
              <Text style={styles.albumTitle} numberOfLines={1}>{post.trackTitle}</Text>
              <Text style={styles.albumArtist} numberOfLines={1}>{post.artist}</Text>
            </View>
            <View style={styles.albumPlayCount}>
              <Ionicons name="headset-outline" size={12} color="rgba(255,255,255,0.8)" />
              <Text style={styles.albumPlayCountText}>
                {(post.playCount / 1000).toFixed(1)}K
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>
    </Pressable>
  );
}

function PostCard({ post }: { post: Post }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { playTrack, tracks } = usePlayer();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [allComments, setAllComments] = useState<PostComment[]>(() => seedComments(post.id));
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [commentInput, setCommentInput] = useState("");
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState("");

  const cat = POST_CATEGORIES[post.category] ?? { icon: "star-outline" as const, color: colors.primary };

  const handleLike = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLiked((v) => !v);
  };

  const handlePlay = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Play inline via PlayerContext — the mini player appears at the bottom and
    // the user stays on the feed. Never navigate to /music-feed (that screen is
    // the separate TikTok-style discovery feed, not where feed posts should play).
    const match = tracks.find((t) => t.title === post.trackTitle);
    if (match) playTrack(match, tracks);
  };

  const openComments = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowComments(true);
  };

  const toggleCommentLike = (id: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setLikedComments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setAllComments((prev) =>
      prev.map((c) => c.id === id ? { ...c, likes: likedComments.has(id) ? c.likes - 1 : c.likes + 1 } : c)
    );
  };

  const submitComment = () => {
    if (!commentInput.trim()) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAllComments((prev) => [{
      id: `user-${Date.now()}`,
      name: "You", photo: "", color: "#e85d4a",
      text: commentInput.trim(), likes: 0, time: "now", replies: [],
    }, ...prev]);
    setCommentInput("");
  };

  return (
    <View style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.postHeader}>
        <TrackCover coverUrl={post.avatarUrl} coverColor={post.avatar} size={40} thumbSize={80} circular iconSize={16} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.postArtistName, { color: colors.foreground }]}>{post.artist}</Text>
          <Text style={[styles.postTime, { color: colors.mutedForeground }]}>{post.time}</Text>
        </View>
        <View style={[styles.categoryPill, { backgroundColor: cat.color + "22", borderColor: cat.color + "55" }]}>
          <Ionicons name={cat.icon} size={11} color={cat.color} />
          <Text style={[styles.categoryText, { color: cat.color }]}>{post.category}</Text>
        </View>
      </View>

      <Text style={[styles.postBody, { color: colors.foreground }]}>{post.body}</Text>
      <AlbumArtCard post={post} onPlay={handlePlay} />

      {/* Engagement row */}
      <View style={styles.engRow}>
        <Pressable style={styles.engBtn} onPress={handleLike}>
          <Ionicons name={liked ? "heart" : "heart-outline"} size={18} color={liked ? "#ff6b6b" : colors.mutedForeground} />
          <Text style={[styles.engCount, { color: liked ? "#ff6b6b" : colors.mutedForeground }]}>
            {(post.likes + (liked ? 1 : 0)).toLocaleString()}
          </Text>
        </Pressable>

        <Pressable style={styles.engBtn} onPress={openComments}>
          <Ionicons name="chatbubble-outline" size={17} color={colors.mutedForeground} />
          <Text style={[styles.engCount, { color: colors.mutedForeground }]}>{allComments.length}</Text>
        </Pressable>

        <Pressable style={styles.engBtn} onPress={() => {
          if (Platform.OS !== "web") Haptics.selectionAsync();
          setReposted((r) => !r);
        }}>
          <Ionicons name="repeat-outline" size={19} color={reposted ? "#10b981" : colors.mutedForeground} />
          <Text style={[styles.engCount, { color: reposted ? "#10b981" : colors.mutedForeground }]}>
            {post.reposts + (reposted ? 1 : 0)}
          </Text>
        </Pressable>

        <Pressable style={styles.engBtn}>
          <Ionicons name="bar-chart-outline" size={17} color={colors.mutedForeground} />
          <Text style={[styles.engCount, { color: colors.mutedForeground }]}>
            {(post.playCount / 1000).toFixed(1)}K
          </Text>
        </Pressable>

        <Pressable style={styles.engBtn} onPress={() => {
          if (Platform.OS !== "web") Haptics.selectionAsync();
          setSaved((v) => !v);
        }}>
          <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={17} color={saved ? colors.primary : colors.mutedForeground} />
        </Pressable>

        <Pressable style={styles.engBtn}>
          <Ionicons name="share-outline" size={17} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* ── Comment sheet ── */}
      <Modal visible={showComments} transparent animationType="slide" onRequestClose={() => setShowComments(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowComments(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.sheetOuter}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 8, backgroundColor: colors.card }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{allComments.length} Comments</Text>
              <Pressable onPress={() => setShowComments(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* Emoji reactions */}
            <View style={styles.sheetReactions}>
              {(["🔥", "❤️", "🎵", "🙌", "🎤", "💯"] as const).map((emoji) => (
                <Pressable key={emoji} style={[styles.reactionPill, { backgroundColor: colors.background }]}
                  onPress={() => {
                    if (Platform.OS !== "web") Haptics.selectionAsync();
                    setCommentInput((prev) => prev + emoji);
                  }}>
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                </Pressable>
              ))}
            </View>

            {/* Comments list */}
            <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {allComments.map((c) => {
                const isLiked = likedComments.has(c.id);
                const isReplying = replyingToId === c.id;
                return (
                  <View key={c.id}>
                    <View style={[styles.sheetCommentRow, { borderBottomColor: colors.border }]}>
                      {/* Avatar → profile */}
                      <Pressable onPress={() => { setShowComments(false); router.push("/(tabs)/profile"); }}>
                        {c.photo ? (
                          <Image source={{ uri: c.photo }} style={styles.sheetAvatarImg} contentFit="cover" />
                        ) : (
                          <View style={[styles.sheetAvatar, { backgroundColor: c.color }]}>
                            <Text style={styles.sheetAvatarText}>{c.name[0]}</Text>
                          </View>
                        )}
                      </Pressable>
                      <View style={styles.sheetCommentBody}>
                        <View style={styles.sheetCommentMeta}>
                          <Text style={[styles.sheetCommentName, { color: colors.foreground }]}>{c.name}</Text>
                          <Text style={[styles.sheetCommentTime, { color: colors.mutedForeground }]}>{c.time}</Text>
                        </View>
                        <Text style={[styles.sheetCommentText, { color: colors.foreground }]}>{c.text}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                          <Pressable style={styles.sheetReplyBtn} onPress={() => {
                            setReplyingToId(isReplying ? null : c.id);
                            setReplyInput("");
                          }}>
                            <Text style={[styles.sheetReplyText, { color: isReplying ? "#e85d4a" : colors.mutedForeground }]}>
                              {isReplying ? "Cancel" : "Reply"}
                            </Text>
                          </Pressable>
                          {c.name === "You" && (
                            <Pressable onPress={() => {
                              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              setAllComments((prev) => prev.filter((cm) => cm.id !== c.id));
                            }}>
                              <Text style={styles.sheetDeleteText}>Delete</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                      <Pressable style={styles.sheetLikeBtn} onPress={() => toggleCommentLike(c.id)}>
                        <Ionicons name={isLiked ? "heart" : "heart-outline"} size={16} color={isLiked ? "#ff6b6b" : colors.mutedForeground} />
                        <Text style={[styles.sheetLikeCount, { color: isLiked ? "#ff6b6b" : colors.mutedForeground }]}>
                          {c.likes + (isLiked ? 1 : 0)}
                        </Text>
                      </Pressable>
                    </View>

                    {/* Nested replies */}
                    {c.replies.map((r) => (
                      <View key={r.id} style={[styles.sheetReplyRow, { borderBottomColor: colors.border }]}>
                        <Text style={styles.replyArrow}>↳</Text>
                        <Pressable onPress={() => { setShowComments(false); router.push("/(tabs)/profile"); }}>
                          {r.photo ? (
                            <Image source={{ uri: r.photo }} style={styles.sheetAvatarImgSm} contentFit="cover" />
                          ) : (
                            <View style={[styles.sheetAvatarSm, { backgroundColor: r.color }]}>
                              <Text style={styles.sheetAvatarTextSm}>{r.name[0]}</Text>
                            </View>
                          )}
                        </Pressable>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.sheetCommentName, { color: colors.foreground, fontSize: 12 }]}>{r.name}
                            <Text style={[styles.sheetCommentTime, { color: colors.mutedForeground }]}> · {r.time}</Text>
                          </Text>
                          <Text style={[styles.sheetCommentText, { color: colors.foreground, fontSize: 13 }]}>{r.text}</Text>
                        </View>
                      </View>
                    ))}

                    {/* Inline reply input */}
                    {isReplying && (
                      <View style={[styles.sheetInlineReplyRow, { borderBottomColor: colors.border }]}>
                        <Text style={styles.replyArrow}>↳</Text>
                        <View style={[styles.sheetAvatarSm, { backgroundColor: "#e85d4a" }]}>
                          <Text style={styles.sheetAvatarTextSm}>Y</Text>
                        </View>
                        <TextInput
                          style={[styles.sheetInput, { flex: 1, paddingVertical: 7, backgroundColor: colors.background, color: colors.foreground }]}
                          placeholder={`Reply to ${c.name}…`}
                          placeholderTextColor={colors.mutedForeground}
                          value={replyInput}
                          onChangeText={setReplyInput}
                          autoFocus
                          returnKeyType="send"
                          onSubmitEditing={() => {
                            if (!replyInput.trim()) return;
                            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setAllComments((prev) => prev.map((cm) =>
                              cm.id === c.id
                                ? { ...cm, replies: [...cm.replies, { id: `reply-${Date.now()}`, name: "You", photo: "", color: "#e85d4a", text: replyInput.trim(), time: "now" }] }
                                : cm
                            ));
                            setReplyInput("");
                            setReplyingToId(null);
                          }}
                        />
                        <Pressable style={styles.sheetSendBtn} onPress={() => {
                          if (!replyInput.trim()) return;
                          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setAllComments((prev) => prev.map((cm) =>
                            cm.id === c.id
                              ? { ...cm, replies: [...cm.replies, { id: `reply-${Date.now()}`, name: "You", photo: "", color: "#e85d4a", text: replyInput.trim(), time: "now" }] }
                              : cm
                          ));
                          setReplyInput("");
                          setReplyingToId(null);
                        }}>
                          <Ionicons name="send" size={16} color="#e85d4a" />
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            {/* Input */}
            <View style={[styles.sheetInputRow, { borderTopColor: colors.border }]}>
              <View style={[styles.sheetInputAvatar, { backgroundColor: "#e85d4a" }]}>
                <Text style={styles.sheetAvatarText}>Y</Text>
              </View>
              <TextInput
                style={[styles.sheetInput, { backgroundColor: colors.background, color: colors.foreground }]}
                placeholder="Add a comment…"
                placeholderTextColor={colors.mutedForeground}
                value={commentInput}
                onChangeText={setCommentInput}
                returnKeyType="send"
                onSubmitEditing={submitComment}
              />
              <Pressable style={[styles.sheetSendBtn, { opacity: commentInput.trim().length > 0 ? 1 : 0.35 }]} onPress={submitComment}>
                <Ionicons name="send" size={18} color="#e85d4a" />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { currentTrack, isPlaying, isLoading, togglePlay, nextTrack, crossDeviceResume, confirmCrossDeviceResume, dismissCrossDeviceResume } = usePlayer();
  const [feedTab, setFeedTab] = useState<FeedTab>("latest");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const displayName = user?.name ?? "Campus";
  const initials = displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const { data: feedTracks } = useQuery({
    queryKey: ["feed"],
    queryFn: () => getFeed({ limit: 20 }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: artists } = useQuery({
    queryKey: ["artists"],
    queryFn: () => getArtists(),
    staleTime: 5 * 60 * 1000,
  });

  // Build posts from real API data
  const CATEGORY_KEYS = Object.keys(POST_CATEGORIES);
  const POST_BODIES = [
    "New Banger Out Now!!!",
    "Studio vibes! Working on something special for you all. Can't wait to share the final track!",
    "Just finished recording — this one hits different 🎵",
    "Live session tonight at 9PM. Tune in to hear the new project first.",
    "The campus energy has been incredible lately. This track is for all of you 🔥",
    "Collab drop incoming... who's ready? 👀",
    "Spent the whole night in the studio and I think we've got something special.",
    "New genre, new era. Dropping this Friday — save the date.",
  ];
  const TIMES = ["2 months ago", "4 months ago", "1 week ago", "3 days ago", "Just now", "1 month ago", "2 weeks ago", "5 days ago"];

  const allPosts: Post[] = (artists ?? []).map((a, i) => {
    const track = feedTracks?.[i];
    const genre = track?.genre ?? a.genre;
    return {
      id: `post-${a.id}`,
      artist: a.name,
      handle: `@${a.name.replace(/\s+/g, "").toLowerCase()}`,
      avatar: a.coverColor,
      avatarUrl: a.avatarUrl,
      time: TIMES[i % TIMES.length],
      category: CATEGORY_KEYS[i % CATEGORY_KEYS.length],
      body: POST_BODIES[i % POST_BODIES.length],
      likes: 15 + (a.followerCount % 200),
      comments: Math.floor(a.followerCount / 100) % 30,
      reposts: Math.floor(a.followerCount / 10) % 50,
      shares: Math.floor(a.followerCount / 50) % 20,
      saves: Math.floor(a.followerCount / 20) % 30,
      albumColor: track?.coverColor ?? a.coverColor,
      albumArtUrl: getAlbumArtUrl(genre, i),
      trackTitle: track?.title ?? `${a.name} - New Track`,
      trackGenre: genre,
      playCount: track?.playCount ?? a.followerCount * 3,
      trackCoverUrl: track?.coverUrl,
      trackCoverColor: track?.coverColor,
    };
  });

  const liveCount = LIVE_ARTISTS.filter((a) => a.live).length;

  const TABS: { id: FeedTab; label: string }[] = [
    { id: "live", label: "Live" },
    { id: "latest", label: "Latest" },
    { id: "trending", label: "Trending" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={allPosts}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
        ListHeaderComponent={
          <>
            {/* ── Header ── */}
            <View style={[styles.header, { paddingTop: topPad + 10 }]}>
              <Pressable onPress={() => setDrawerOpen(true)}>
                {user?.avatarUrl ? (
                  <Image
                    source={{ uri: user.avatarUrl }}
                    style={styles.headerAvatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.headerAvatar, { backgroundColor: "#3a3a3a" }]}>
                    <Text style={styles.headerAvatarText}>{initials}</Text>
                  </View>
                )}
              </Pressable>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.headerTitle, { color: colors.foreground }]}>Artist Feed</Text>
                <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
                  See what artists are sharing
                </Text>
              </View>
              <Pressable style={[styles.iconBtn, { backgroundColor: colors.card }]}>
                <Ionicons name="notifications-outline" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            {/* ── Cross-device resume prompt ── */}
            {crossDeviceResume && (
              <ResumePromptBanner
                prompt={crossDeviceResume}
                onResume={confirmCrossDeviceResume}
                onDismiss={dismissCrossDeviceResume}
              />
            )}

            {/* ── Live Now strip ── */}
            <View style={[styles.liveStrip, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.liveStripHeader}>
                <PulsingDot />
                <Text style={[styles.liveStripTitle, { color: colors.foreground }]}>Live Now</Text>
                <View style={styles.liveStripRight}>
                  <Text style={[styles.liveStripCount, { color: colors.mutedForeground }]}>
                    {liveCount} streaming
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.liveRow}
              >
                {LIVE_ARTISTS.map((a) => <LiveChip key={a.id} artist={a} />)}
              </ScrollView>
            </View>

            {/* ── Feed tabs ── */}
            <View style={[styles.feedTabs, { borderColor: colors.border }]}>
              {TABS.map((tab) => {
                const active = feedTab === tab.id;
                return (
                  <Pressable
                    key={tab.id}
                    style={[
                      styles.feedTab,
                      { backgroundColor: active ? colors.foreground : colors.card, borderColor: colors.border },
                    ]}
                    onPress={() => {
                      if (Platform.OS !== "web") Haptics.selectionAsync();
                      setFeedTab(tab.id);
                    }}
                  >
                    <Text style={[styles.feedTabText, { color: active ? colors.background : colors.mutedForeground }]}>
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        }
        renderItem={({ item }) => <PostCard post={item} />}
      />

      <NowPlayingBar
        track={currentTrack}
        isPlaying={isPlaying}
        isLoading={isLoading}
        onToggle={togglePlay}
        onNext={nextTrack}
        onPress={() => router.push("/player")}
      />

      <EcosystemDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  headerTitle: { fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  headerSub: { fontSize: 12, marginTop: 1 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  // Live strip
  liveStrip: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  liveStripHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 14,
  },
  liveStripTitle: { fontSize: 14, fontWeight: "800", flex: 1 },
  liveStripRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  liveStripCount: { fontSize: 12 },
  liveRow: { gap: 14, paddingHorizontal: 2, paddingTop: 6 },

  // Live chip
  liveChipWrap: { alignItems: "center", width: 72, overflow: "visible" },
  liveChipCircleWrap: {
    width: 72,
    height: 72,
    marginBottom: 6,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "visible",
  },
  liveRing: {
    position: "absolute",
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2.5,
  },
  liveBadge: {
    position: "absolute",
    bottom: -2,
    alignSelf: "center",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  liveBadgeText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.4,
    lineHeight: 10,
    includeFontPadding: false,
  },
  liveChipName: { fontSize: 11, fontWeight: "600", textAlign: "center" },

  // Feed tabs
  feedTabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  feedTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
    borderWidth: 1,
  },
  feedTabText: { fontSize: 14, fontWeight: "600" },

  // Post card
  postCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    paddingBottom: 8,
  },
  postArtistName: { fontSize: 14, fontWeight: "700", marginBottom: 1 },
  postTime: { fontSize: 12 },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  categoryText: { fontSize: 11, fontWeight: "600" },

  postBody: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },

  // Album art card
  albumCardWrap: {
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 14,
    overflow: "hidden",
  },
  albumCard: {
    height: 280,
    justifyContent: "space-between",
  },
  albumCardImage: {
    borderRadius: 14,
  },
  albumDarkOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.12)",
    borderRadius: 14,
  },
  albumGenrePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    margin: 12,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  albumGenreText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  albumCenterPlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  albumPlayBtnBg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  albumGradient: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 40,
  },
  albumInfo: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  albumTitle: { color: "#fff", fontSize: 18, fontWeight: "800", letterSpacing: -0.3, marginBottom: 2 },
  albumArtist: { color: "rgba(255,255,255,0.75)", fontSize: 13 },
  albumPlayCount: { flexDirection: "row", alignItems: "center", gap: 4 },
  albumPlayCountText: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "600" },

  engRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  engBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  engCount: { fontSize: 14 },

  // Comment sheet
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheetOuter: { maxHeight: "78%" },
  sheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 12,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: "#444",
    alignSelf: "center", marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 14,
  },
  sheetTitle: { fontSize: 16, fontWeight: "700" },
  sheetReactions: { flexDirection: "row", gap: 10, marginBottom: 16 },
  reactionPill: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  reactionEmoji: { fontSize: 20 },
  sheetScroll: { maxHeight: 360 },
  sheetCommentRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  sheetAvatarImg: { width: 36, height: 36, borderRadius: 18, flexShrink: 0 },
  sheetAvatarSm: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  sheetAvatarImgSm: { width: 28, height: 28, borderRadius: 14, flexShrink: 0 },
  sheetAvatarText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  sheetAvatarTextSm: { color: "#fff", fontSize: 11, fontWeight: "700" },
  replyArrow: {
    color: "#555", fontSize: 16, marginTop: 4, marginRight: -2, width: 18,
  },
  sheetReplyRow: {
    flexDirection: "row", alignItems: "flex-start",
    gap: 6, paddingVertical: 8, marginLeft: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetInlineReplyRow: {
    flexDirection: "row", alignItems: "center",
    gap: 6, paddingVertical: 8, paddingRight: 4, marginLeft: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetCommentBody: { flex: 1 },
  sheetCommentMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  sheetCommentName: { fontSize: 13, fontWeight: "600" },
  sheetCommentTime: { fontSize: 11 },
  sheetCommentText: { fontSize: 14, lineHeight: 20 },
  sheetReplyBtn: { marginTop: 4 },
  sheetReplyText: { fontSize: 12 },
  sheetDeleteText: { color: "#e85d4a", fontSize: 12, marginTop: 4 },
  sheetLikeBtn: { alignItems: "center", gap: 3, paddingLeft: 4, paddingTop: 2 },
  sheetLikeCount: { fontSize: 11 },
  sheetInputRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingTop: 12, paddingBottom: 4, paddingLeft: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetInputAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    overflow: "hidden", flexShrink: 0,
  },
  sheetInput: {
    flex: 1, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
  },
  sheetSendBtn: { padding: 6 },
});
