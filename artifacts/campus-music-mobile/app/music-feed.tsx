import { Ionicons } from "@/components/icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  Dimensions,
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
  ViewToken,
} from "react-native";
import { getAlbumArtUrl } from "@/utils/albumArt";
import { colorToBlurhash } from "@/utils/blurhash";
import { resizeCoverUrl } from "@/utils/coverUrl";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlayer } from "@/context/PlayerContext";
import { useColors } from "@/hooks/useColors";
import { Track } from "@/components/MusicCard";

const { width: W, height: H } = Dimensions.get("window");

// ── Seed comments keyed by track index ────────────────────────────────────────
const COMMENT_POOL: string[][] = [
  [
    "This beat is everything 🔥",
    "Playing this on repeat all week",
    "Found my new study playlist",
    "The production on this is insane",
    "MIT kids really eating good rn",
    "Who produced this? Need a collab ASAP",
    "Heard this in the dining hall and Shazamed it immediately",
    "This is why I transferred here honestly",
    "The bass line at 1:24 is unreal 😭",
    "My roommate is obsessed with this now",
    "First campus track to hit different on headphones",
    "Stream count should be way higher fr",
  ],
  [
    "I discovered this artist last week omg",
    "Soundtrack to my 2am grind sessions",
    "Someone send me the Spotify link",
    "This slaps different at the library",
    "Bro really said study music 💀",
    "Okay the bridge just made me stop walking",
    "Put this on at 3am and cried a little ngl",
    "This is giving Bon Iver but make it campus",
    "My professor played this in class and I lost it",
    "The lyrics though… whoever wrote this needs a deal",
    "Saw them perform this live at the quad last semester 🙌",
    "Whoever mixed this deserves an award no cap",
  ],
  [
    "Campus Collective never misses",
    "Drop an album please 🙏",
    "This came on at the quad and everyone stopped",
    "Clean mix, who produced this?",
    "Been on loop since Friday",
    "Every track on this playlist is a vibe",
    "Finally some music that actually sounds like us",
    "Played this at my study group and now everyone follows",
    "The way this makes me feel understood 💙",
    "Okay I need this on vinyl RIGHT NOW",
    "Shout out whoever curated this drop fr",
    "This is the soundtrack to my whole semester",
  ],
  [
    "The vibe is unmatched",
    "First time hearing this — instant follow",
    "This is what campus music should be",
    "Low key crying rn ngl",
    "Perfect for late night walks 🌙",
    "Showed this to my whole floor and now it's a group chat anthem",
    "The melody lives rent free in my head",
    "Okay this artist is about to blow up watch",
    "Genuinely the most atmospheric thing I've heard this year",
    "Campus music app is the best decision I ever made",
    "Someone make this the graduation song please",
    "This track is a whole cinematic universe",
  ],
  [
    "THE HOOK IS CRAZY",
    "Grew up listening to this genre, never heard it done this well",
    "Artist collab when??",
    "My whole dorm is listening to this rn",
    "This should be at the next open mic",
    "Woke up thinking about this track, that's how you know it hits",
    "If this doesn't make the campus playlist I'm rioting",
    "The energy in the drop is unmatched 🎶",
    "I've recommended this to like 20 people today",
    "This artist is going to be famous, calling it now",
    "Okay the guitar in the outro gave me chills",
    "This is peak campus culture right here",
  ],
];

const COMMENTER_NAMES = ["Alex", "Jordan", "Mia", "DeShawn", "Priya", "Kofi", "Sofia", "Liam", "Amara", "Tyler", "Zoe", "Marcus", "Nia", "Ethan", "Layla"];
const COMMENTER_COLORS = ["#e85d4a", "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#0ea5e9", "#14b8a6"];
const COMMENTER_PHOTOS: Record<string, string> = {
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
  Zoe:     "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&q=80&fit=crop&crop=face",
  Marcus:  "https://images.unsplash.com/photo-1463453091185-61582044d556?w=160&q=80&fit=crop&crop=face",
  Nia:     "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=160&q=80&fit=crop&crop=face",
  Ethan:   "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=160&q=80&fit=crop&crop=face",
  Layla:   "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=160&q=80&fit=crop&crop=face",
};

type Reply = { id: string; name: string; photo: string; color: string; text: string; time: string; };
type Comment = {
  id: string;
  name: string;
  photo: string;
  color: string;
  text: string;
  likes: number;
  time: string;
  replies: Reply[];
};

function getCommentsForIndex(idx: number): Comment[] {
  const pool = COMMENT_POOL[idx % COMMENT_POOL.length];
  return pool.map((text, i) => ({
    id: `${idx}-${i}`,
    name: COMMENTER_NAMES[(idx + i) % COMMENTER_NAMES.length],
    photo: COMMENTER_PHOTOS[COMMENTER_NAMES[(idx + i) % COMMENTER_NAMES.length]] ?? "",
    color: COMMENTER_COLORS[(idx + i) % COMMENTER_COLORS.length],
    text,
    likes: (idx * 7 + i * 13 + 5) % 200 + 5,
    time: `${[1, 3, 7, 12, 18, 25, 34, 45, 52, 61, 78, 90][i % 12]}m`,
    replies: [],
  }));
}

// ── Single full-screen track card ─────────────────────────────────────────────
function TrackFeedCard({
  track,
  index,
  isActive,
  isPlaying,
  onToggle,
  onLike,
  liked,
}: {
  track: Track;
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  onToggle: () => void;
  onLike: () => void;
  liked: boolean;
}) {
  const insets = useSafeAreaInsets();
  const seedComments = getCommentsForIndex(index);
  const cardHeight = Platform.OS === "web" ? H - 84 : H;
  const rawUrl = track.coverUrl ?? getAlbumArtUrl(track.genre, index);
  const artUrl = resizeCoverUrl(rawUrl, W * 2);
  const blurhash = colorToBlurhash(track.coverColor);

  const [showComments, setShowComments] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [allComments, setAllComments] = useState<Comment[]>(seedComments);
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [reposted, setReposted] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState("");

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
      prev.map((c) =>
        c.id === id ? { ...c, likes: likedComments.has(id) ? c.likes - 1 : c.likes + 1 } : c
      )
    );
  };

  const submitComment = () => {
    if (!commentInput.trim()) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newComment: Comment = {
      id: `user-${Date.now()}`,
      name: "You",
      photo: "",
      color: "#e85d4a",
      text: commentInput.trim(),
      likes: 0,
      time: "now",
      replies: [],
    };
    setAllComments((prev) => [newComment, ...prev]);
    setCommentInput("");
  };

  return (
    <View style={[styles.card, { height: cardHeight, backgroundColor: track.coverColor }]}>
      {/* Full-bleed cover art */}
      <Image
        source={{ uri: artUrl }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        placeholder={{ blurhash }}
        transition={300}
        cachePolicy="memory-disk"
      />

      {/* Full-screen gradient */}
      <LinearGradient
        colors={["rgba(0,0,0,0.25)", "rgba(0,0,0,0.0)", "rgba(0,0,0,0.88)"]}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Right action bar ── */}
      <View style={[styles.actionBar, { bottom: Platform.OS === "web" ? 160 : insets.bottom + 110 }]}>
        {/* Like */}
        <Pressable style={styles.actionBtn} onPress={onLike}>
          <Ionicons name={liked ? "heart" : "heart-outline"} size={30} color={liked ? "#ff6b6b" : "#fff"} />
          <Text style={styles.actionCount}>{(track.likes ?? 0).toLocaleString()}</Text>
        </Pressable>

        {/* Comments — opens sheet */}
        <Pressable style={styles.actionBtn} onPress={openComments}>
          <Ionicons name="chatbubble-outline" size={28} color="#fff" />
          <Text style={styles.actionCount}>{allComments.length}</Text>
        </Pressable>

        {/* Repost */}
        <Pressable style={styles.actionBtn} onPress={() => {
          if (Platform.OS !== "web") Haptics.selectionAsync();
          setReposted((r) => !r);
        }}>
          <Ionicons name="repeat-outline" size={30} color={reposted ? "#10b981" : "#fff"} />
          <Text style={[styles.actionCount, reposted && { color: "#10b981" }]}>
            {Math.floor((track.playCount ?? 0) / 50) + (reposted ? 1 : 0)}
          </Text>
        </Pressable>

        {/* Share */}
        <Pressable style={styles.actionBtn}>
          <Ionicons name="share-outline" size={28} color="#fff" />
        </Pressable>

        {/* Save */}
        <Pressable style={styles.actionBtn} onPress={() => {
          if (Platform.OS !== "web") Haptics.selectionAsync();
          setBookmarked((b) => !b);
        }}>
          <Ionicons name={bookmarked ? "bookmark" : "bookmark-outline"} size={26} color={bookmarked ? "#f59e0b" : "#fff"} />
        </Pressable>
      </View>

      {/* ── Bottom info + comment preview ── */}
      <View style={[styles.bottomSection, { paddingBottom: Platform.OS === "web" ? 160 : insets.bottom + 100 }]}>
        <View style={styles.trackRow}>
          <View style={[styles.artistAvatar, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
            <Ionicons name="person" size={16} color="#fff" />
          </View>
          <Text style={styles.artistName}>{track.artist}</Text>
          <View style={styles.genrePill}>
            <Text style={styles.genreText}>{track.genre}</Text>
          </View>
        </View>
        <Text style={styles.trackTitle} numberOfLines={2}>{track.title}</Text>
        <View style={styles.playCountRow}>
          <Ionicons name="headset-outline" size={13} color="rgba(255,255,255,0.7)" />
          <Text style={styles.playCountText}>{((track.playCount ?? 0) / 1000).toFixed(1)}K plays</Text>
        </View>

        {/* Preview: first 3 comments, tapping opens sheet */}
        <Pressable style={styles.commentsSection} onPress={openComments}>
          {allComments.slice(0, 3).map((c) => (
            <View key={c.id} style={styles.commentRow}>
              <View style={[styles.commenterBadge, { backgroundColor: c.color }]}>
                <Text style={styles.commenterInitial}>{c.name[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.commenterName}>{c.name}</Text>
                <Text style={styles.commentText} numberOfLines={1}>{c.text}</Text>
              </View>
            </View>
          ))}
          <Text style={styles.viewAllComments}>View all {allComments.length} comments →</Text>
        </Pressable>
      </View>

      {/* ── Play/pause tap zone ── */}
      <Pressable
        style={styles.playZone}
        onPress={() => {
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggle();
        }}
      >
        {!isPlaying && isActive && (
          <View style={styles.pausedIndicator}>
            <Ionicons name="play" size={48} color="rgba(255,255,255,0.9)" />
          </View>
        )}
      </Pressable>

      {/* ── Comment sheet modal ── */}
      <Modal
        visible={showComments}
        transparent
        animationType="slide"
        onRequestClose={() => setShowComments(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowComments(false)} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.sheetContainer}
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
            {/* Handle + header */}
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{allComments.length} Comments</Text>
              <Pressable onPress={() => setShowComments(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color="#aaa" />
              </Pressable>
            </View>

            {/* Reaction row */}
            <View style={styles.sheetReactions}>
              {(["🔥", "❤️", "🎵", "🙌", "🎤", "💯"] as const).map((emoji) => (
                <Pressable key={emoji} style={styles.reactionPill} onPress={() => {
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
                    <View style={styles.sheetCommentRow}>
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
                          <Text style={styles.sheetCommentName}>{c.name}</Text>
                          <Text style={styles.sheetCommentTime}>{c.time}</Text>
                        </View>
                        <Text style={styles.sheetCommentText}>{c.text}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                          <Pressable style={styles.sheetReplyBtn} onPress={() => {
                            setReplyingToId(isReplying ? null : c.id);
                            setReplyInput("");
                          }}>
                            <Text style={[styles.sheetReplyText, isReplying && { color: "#e85d4a" }]}>
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
                        <Ionicons name={isLiked ? "heart" : "heart-outline"} size={16} color={isLiked ? "#ff6b6b" : "#888"} />
                        <Text style={[styles.sheetLikeCount, isLiked && { color: "#ff6b6b" }]}>
                          {c.likes + (isLiked ? 1 : 0)}
                        </Text>
                      </Pressable>
                    </View>

                    {/* Nested replies */}
                    {c.replies.map((r) => (
                      <View key={r.id} style={styles.sheetReplyRow}>
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
                          <Text style={[styles.sheetCommentName, { fontSize: 12 }]}>{r.name}
                            <Text style={styles.sheetCommentTime}> · {r.time}</Text>
                          </Text>
                          <Text style={[styles.sheetCommentText, { fontSize: 13 }]}>{r.text}</Text>
                        </View>
                      </View>
                    ))}

                    {/* Inline reply input */}
                    {isReplying && (
                      <View style={styles.sheetInlineReplyRow}>
                        <Text style={styles.replyArrow}>↳</Text>
                        <View style={[styles.sheetAvatarSm, { backgroundColor: "#e85d4a" }]}>
                          <Text style={styles.sheetAvatarTextSm}>Y</Text>
                        </View>
                        <TextInput
                          style={[styles.sheetInput, { flex: 1, paddingVertical: 7 }]}
                          placeholder={`Reply to ${c.name}…`}
                          placeholderTextColor="#666"
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

            {/* Input row */}
            <View style={styles.sheetInputRow}>
              <View style={[styles.sheetInputAvatar, { backgroundColor: "#e85d4a" }]}>
                <Text style={styles.sheetAvatarText}>Y</Text>
              </View>
              <TextInput
                style={styles.sheetInput}
                placeholder="Add a comment…"
                placeholderTextColor="#666"
                value={commentInput}
                onChangeText={setCommentInput}
                multiline={false}
                returnKeyType="send"
                onSubmitEditing={submitComment}
              />
              <Pressable
                style={[styles.sheetSendBtn, { opacity: commentInput.trim().length > 0 ? 1 : 0.35 }]}
                onPress={submitComment}
              >
                <Ionicons name="send" size={18} color="#e85d4a" />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Feed screen ───────────────────────────────────────────────────────────────
export default function MusicFeedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { tracks, currentTrack, isPlaying, playTrack, togglePlay, toggleLike } = usePlayer();
  const [activeIndex, setActiveIndex] = useState(0);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const listRef = useRef<FlatList>(null);

  const cardHeight = Platform.OS === "web" ? H - 84 : H;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        const idx = viewableItems[0].index ?? 0;
        setActiveIndex(idx);
        const track = tracks[idx];
        if (track && currentTrack?.id !== track.id) {
          playTrack(track, tracks);
        }
      }
    },
    [tracks, currentTrack, playTrack]
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;

  const handleLike = (trackId: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLiked((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId); else next.add(trackId);
      return next;
    });
    toggleLike(trackId);
  };

  if (tracks.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.background }]}>
        <Ionicons name="musical-notes-outline" size={64} color={colors.mutedForeground} />
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Loading feed...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Back button */}
      <Pressable
        style={[styles.backBtn, { top: Platform.OS === "web" ? 80 : insets.top + 12 }]}
        onPress={() => router.back()}
        hitSlop={12}
      >
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </Pressable>

      {/* Track indicator */}
      <View style={[styles.titleBar, { top: Platform.OS === "web" ? 76 : insets.top + 8 }]}>
        <Text style={styles.titleBarText}>Music Feed</Text>
      </View>

      <FlatList
        ref={listRef}
        data={tracks}
        keyExtractor={(t) => t.id}
        pagingEnabled
        snapToInterval={cardHeight}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, index) => ({
          length: cardHeight,
          offset: cardHeight * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item, index }) => (
          <TrackFeedCard
            track={item}
            index={index}
            isActive={index === activeIndex}
            isPlaying={isPlaying && currentTrack?.id === item.id}
            onToggle={togglePlay}
            onLike={() => handleLike(item.id)}
            liked={liked.has(item.id)}
          />
        )}
      />

      {/* Scroll hint dots */}
      <View style={[styles.dots, { right: 8, top: "50%" }]}>
        {tracks.slice(0, 8).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i === activeIndex
                  ? "#fff"
                  : "rgba(255,255,255,0.35)",
                height: i === activeIndex ? 20 : 6,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },

  card: {
    width: W,
    overflow: "hidden",
    position: "relative",
  },

  playZone: {
    position: "absolute",
    top: "20%",
    left: 0,
    right: 80,
    bottom: "45%",
    alignItems: "center",
    justifyContent: "center",
  },
  pausedIndicator: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Right action bar
  actionBar: {
    position: "absolute",
    right: 14,
    alignItems: "center",
    gap: 22,
  },
  actionBtn: { alignItems: "center", gap: 4 },
  actionCount: { color: "#fff", fontSize: 12, fontWeight: "600" },

  // Bottom info
  bottomSection: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 80,
    paddingHorizontal: 16,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  artistAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.5)",
  },
  artistName: { color: "#fff", fontSize: 14, fontWeight: "700", flex: 1 },
  genrePill: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  genreText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  trackTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  playCountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 14,
  },
  playCountText: { color: "rgba(255,255,255,0.7)", fontSize: 13 },

  // Comments (card preview)
  commentsSection: { gap: 8 },
  commentRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  commenterBadge: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  commenterInitial: { color: "#fff", fontSize: 11, fontWeight: "700" },
  commenterName: { color: "rgba(255,255,255,0.6)", fontSize: 11, marginBottom: 1 },
  commentText: { color: "#fff", fontSize: 13, lineHeight: 18 },
  viewAllComments: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 },

  // Comment sheet modal
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheetContainer: {
    maxHeight: "78%",
  },
  sheet: {
    backgroundColor: "#141414",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#444",
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sheetTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  sheetReactions: {
    flexDirection: "row", gap: 10, marginBottom: 16,
  },
  reactionPill: {
    backgroundColor: "#222",
    borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  reactionEmoji: { fontSize: 20 },
  sheetScroll: { maxHeight: 380 },
  sheetCommentRow: {
    flexDirection: "row", alignItems: "flex-start",
    gap: 10, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
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
    gap: 6, paddingVertical: 8,
    marginLeft: 28,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#222",
  },
  sheetInlineReplyRow: {
    flexDirection: "row", alignItems: "center",
    gap: 6, paddingVertical: 8, paddingRight: 4,
    marginLeft: 28,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#222",
  },
  sheetCommentBody: { flex: 1 },
  sheetCommentMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  sheetCommentName: { color: "#fff", fontSize: 13, fontWeight: "600" },
  sheetCommentTime: { color: "#666", fontSize: 11 },
  sheetCommentText: { color: "#ddd", fontSize: 14, lineHeight: 20 },
  sheetReplyBtn: { marginTop: 4 },
  sheetReplyText: { color: "#888", fontSize: 12 },
  sheetDeleteText: { color: "#e85d4a", fontSize: 12, marginTop: 4 },
  sheetLikeBtn: { alignItems: "center", gap: 3, paddingLeft: 4, paddingTop: 2 },
  sheetLikeCount: { color: "#888", fontSize: 11 },
  sheetInputRow: {
    flexDirection: "row", alignItems: "center",
    gap: 10, paddingTop: 12, paddingBottom: 4,
    paddingLeft: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#222",
  },
  sheetInputAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    overflow: "hidden", flexShrink: 0,
  },
  sheetInput: {
    flex: 1,
    backgroundColor: "#222", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10,
    color: "#fff", fontSize: 14,
  },
  sheetSendBtn: { padding: 6 },

  // Progress dots
  dots: {
    position: "absolute",
    alignItems: "center",
    gap: 4,
    transform: [{ translateY: -60 }],
  },
  dot: { width: 4, borderRadius: 3 },

  // Header
  backBtn: {
    position: "absolute",
    left: 16,
    zIndex: 100,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 20,
  },
  titleBar: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 99,
    alignItems: "center",
  },
  titleBarText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  emptyText: { fontSize: 16 },
});
