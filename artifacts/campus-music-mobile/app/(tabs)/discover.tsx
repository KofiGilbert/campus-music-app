import { Ionicons } from "@/components/icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { TrackCover } from "@/components/TrackCover";
import { getAlbumArtUrl } from "@/utils/albumArt";
import { resizeCoverUrl } from "@/utils/coverUrl";
import { colorToBlurhash } from "@/utils/blurhash";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { search as searchApi, useGetMostLikedTracks } from "@workspace/api-client-react";
import { MusicCard } from "@/components/MusicCard";
import { NowPlayingBar } from "@/components/NowPlayingBar";
import { SectionHeader } from "@/components/SectionHeader";
import { GENRES, usePlayer } from "@/context/PlayerContext";
import { useColors } from "@/hooks/useColors";
import { Track } from "@/components/MusicCard";

// ─── Now-Listening story circle ───────────────────────────────────────────────
const NOW_LISTENING_USERS = [
  { id: "u1", name: "Radio DePaul", color: "#e85d4a", trackColor: "#3b82f6",
    logo: require("@/assets/images/logos/depaul.png") },
  { id: "u2", name: "Northwestern Radio", color: "#8b5cf6", trackColor: "#10b981",
    logo: require("@/assets/images/logos/northwestern.png") },
  { id: "u3", name: "Harvard Radio", color: "#3b82f6", trackColor: "#f59e0b",
    logo: require("@/assets/images/logos/harvard.png") },
  { id: "u4", name: "Voice of UM", color: "#10b981", trackColor: "#e85d4a",
    logo: require("@/assets/images/logos/michigan.png") },
  { id: "u5", name: "Carolina Radio", color: "#f59e0b", trackColor: "#8b5cf6",
    logo: require("@/assets/images/logos/unc.png") },
  { id: "u6", name: "Album 88", color: "#ec4899", trackColor: "#0ea5e9",
    logo: require("@/assets/images/logos/georgiastate.png") },
];

const CAMPUS_PODCASTS = [
  {
    id: "p1", title: "The Vinyl Hour", host: "Radio DePaul",
    type: "Campus Radio", episodes: 48, color: "#e85d4a", newEp: true,
    cover: "https://images.unsplash.com/photo-1542621334-a254cf47733d",
  },
  {
    id: "p2", title: "Campus Frequency", host: "Northwestern Radio",
    type: "Radio Station", episodes: 31, color: "#8b5cf6", newEp: true,
    cover: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618",
  },
  {
    id: "p3", title: "Studio Sessions", host: "Harvard Music Dept",
    type: "Music Department", episodes: 22, color: "#3b82f6", newEp: false,
    cover: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
  },
  {
    id: "p4", title: "Basement Beats", host: "Student Collective",
    type: "Student Podcast", episodes: 64, color: "#10b981", newEp: true,
    cover: "https://images.unsplash.com/photo-1598387993441-a364f854c3e1",
  },
  {
    id: "p5", title: "The Jazz Lab", host: "Prof. Marcus Webb",
    type: "Professor", episodes: 17, color: "#f59e0b", newEp: false,
    cover: "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f",
  },
  {
    id: "p6", title: "Sounds Like Campus", host: "Voice of UM",
    type: "Radio Station", episodes: 39, color: "#ec4899", newEp: true,
    cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f",
  },
];

const TRENDING_COUNTRIES = [
  { id: "c1",  name: "United States", flag: "https://flagcdn.com/w320/us.png",  track: "Golden Hour",      streams: "2.1M" },
  { id: "c2",  name: "United Kingdom",flag: "https://flagcdn.com/w320/gb.png",  track: "Midnight Canvas",  streams: "1.4M" },
  { id: "c3",  name: "Ghana",         flag: "https://flagcdn.com/w320/gh.png",  track: "Street Cypher",    streams: "760K" },
  { id: "c4",  name: "Nigeria",       flag: "https://flagcdn.com/w320/ng.png",  track: "Street Cypher",    streams: "1.2M" },
  { id: "c5",  name: "Japan",         flag: "https://flagcdn.com/w320/jp.png",  track: "Study Hall",       streams: "870K" },
  { id: "c6",  name: "South Korea",   flag: "https://flagcdn.com/w320/kr.png",  track: "Electric Bloom",   streams: "1.6M" },
  { id: "c7",  name: "France",        flag: "https://flagcdn.com/w320/fr.png",  track: "Café au Lait",     streams: "740K" },
  { id: "c8",  name: "Germany",       flag: "https://flagcdn.com/w320/de.png",  track: "Wavelength",       streams: "920K" },
  { id: "c9",  name: "South Africa",  flag: "https://flagcdn.com/w320/za.png",  track: "Garden Path",      streams: "610K" },
  { id: "c10", name: "India",         flag: "https://flagcdn.com/w320/in.png",  track: "Mountain Echo",    streams: "1.8M" },
  { id: "c11", name: "Mexico",        flag: "https://flagcdn.com/w320/mx.png",  track: "Dorm Room Blues",  streams: "830K" },
  { id: "c12", name: "Australia",     flag: "https://flagcdn.com/w320/au.png",  track: "Underground Pulse",streams: "590K" },
  { id: "c13", name: "Brazil",        flag: "https://flagcdn.com/w320/br.png",  track: "Quad Vibes",       streams: "980K" },
];

const GENRE_VIBES = [
  { label: "Hip Hop", color: "#e85d4a", count: 42 },
  { label: "Lo-Fi", color: "#8b5cf6", count: 31 },
  { label: "Jazz", color: "#3b82f6", count: 18 },
  { label: "R&B", color: "#10b981", count: 27 },
  { label: "Indie", color: "#f59e0b", count: 15 },
  { label: "Electronic", color: "#ec4899", count: 23 },
];

function NowListeningCircle({ user, track, onPress }: {
  user: typeof NOW_LISTENING_USERS[0];
  track?: Track;
  onPress: () => void;
}) {
  const colors = useColors();
  const pulse = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const artColor = track?.coverColor ?? user.trackColor;

  return (
    <Pressable style={ds.nowWrap} onPress={onPress}>
      <View style={ds.nowOuter}>
        <Animated.View style={[ds.nowRing, { borderColor: artColor, transform: [{ scale: pulse }] }]} />
        <View style={ds.nowArt}>
          <Image
            source={user.logo}
            style={ds.nowLogo}
            resizeMode="contain"
          />
        </View>
        <View style={[ds.nowBadge, { backgroundColor: user.color }]}>
          <Text style={ds.nowBadgeText}>{user.name[0]}</Text>
        </View>
      </View>
      <Text style={[ds.nowName, { color: colors.mutedForeground }]} numberOfLines={1}>{user.name}</Text>
    </Pressable>
  );
}

function PodcastCard({ pod }: { pod: typeof CAMPUS_PODCASTS[0] }) {
  const colors = useColors();
  const uri = resizeCoverUrl(pod.cover, 300);
  const blurhash = colorToBlurhash(pod.color);
  return (
    <Pressable
      style={ds.podCard}
      onPress={() => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
    >
      {/* Square cover — expo-image with cached thumbnail + color placeholder */}
      <View style={ds.podArt}>
        <ExpoImage
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
          contentFit="cover"
          placeholder={{ blurhash }}
          transition={200}
          cachePolicy="memory-disk"
        />
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.55)"]} style={[StyleSheet.absoluteFill, { borderRadius: 14 }]} />
        {/* Type badge — top right */}
        <View style={ds.podTypeBadge}>
          <Text style={ds.podTypeText} numberOfLines={1}>{pod.type}</Text>
        </View>
        {pod.newEp && (
          <View style={ds.podNewBadge}>
            <Text style={ds.podNewText}>NEW EP</Text>
          </View>
        )}
        <View style={ds.podPlayBtn}>
          <Ionicons name="play" size={18} color="#fff" style={{ marginLeft: 2 }} />
        </View>
      </View>
      {/* Clean text below */}
      <Text style={[ds.podTitle, { color: colors.foreground }]} numberOfLines={1}>{pod.title}</Text>
      <Text style={[ds.podHost, { color: colors.mutedForeground }]} numberOfLines={1}>{pod.host}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
        <Ionicons name="headset-outline" size={11} color={colors.mutedForeground} />
        <Text style={[ds.podEps, { color: colors.mutedForeground }]}>{pod.episodes} eps</Text>
      </View>
    </Pressable>
  );
}

function CountryCard({ country }: { country: typeof TRENDING_COUNTRIES[0] }) {
  const colors = useColors();
  return (
    <Pressable style={ds.countryCard}>
      <ImageBackground
        source={{ uri: country.flag }}
        style={ds.countryArt}
        imageStyle={{ borderRadius: 14 }}
        resizeMode="cover"
      >
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.52)"]}
          style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
        />
        <View style={ds.countryStreamsTag}>
          <Ionicons name="headset-outline" size={9} color="rgba(255,255,255,0.9)" />
          <Text style={ds.countryStreamsText}>{country.streams}</Text>
        </View>
      </ImageBackground>
      <Text style={[ds.countryName, { color: colors.foreground }]} numberOfLines={1}>{country.name}</Text>
      <Text style={[ds.countryTrack, { color: colors.mutedForeground }]} numberOfLines={1}>{country.track}</Text>
    </Pressable>
  );
}

function HeroCard({ track, onPlay, isPlaying, isCurrent, index }: {
  track: Track; onPlay: (t: Track) => void; isPlaying: boolean; isCurrent: boolean; index: number;
}) {
  const active = isCurrent && isPlaying;
  const artUrl = getAlbumArtUrl(track.genre, index);
  return (
    <Pressable onPress={() => onPlay(track)}>
      <ImageBackground
        source={{ uri: artUrl }}
        style={[ds.hero, { backgroundColor: "#1a1a1a" }]}
        imageStyle={{ borderRadius: 20 }}
        resizeMode="cover"
      >
        <LinearGradient colors={["rgba(0,0,0,0.2)", "rgba(0,0,0,0.75)"]} style={StyleSheet.absoluteFill} />
        <View style={ds.heroPlayCount}>
          <Ionicons name="headset-outline" size={13} color="rgba(255,255,255,0.85)" />
          <Text style={ds.heroPlayCountText}>{((track.playCount ?? 0) / 1000).toFixed(1)}K plays</Text>
        </View>
        <View style={ds.heroBottom}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <View style={ds.heroBadgeRow}>
              <View style={ds.heroBadge}><Text style={ds.heroBadgeText}>#1 ON CAMPUS</Text></View>
            </View>
            <Text style={ds.heroTitle} numberOfLines={1}>{track.title}</Text>
            <Text style={ds.heroArtist} numberOfLines={1}>{track.artist}</Text>
          </View>
          <View style={ds.heroBtn}>
            <Ionicons name={active ? "pause" : "play"} size={26} color={track.coverColor} />
          </View>
        </View>
      </ImageBackground>
    </Pressable>
  );
}

function TrendingRow({ track, rank, onPlay, isCurrent, isPlaying }: {
  track: Track; rank: number; onPlay: (t: Track) => void; isCurrent: boolean; isPlaying: boolean;
}) {
  const colors = useColors();
  const active = isCurrent && isPlaying;
  const artUrl = getAlbumArtUrl(track.genre, rank - 1);
  return (
    <Pressable style={[ds.trendRow, { backgroundColor: colors.card }]} onPress={() => onPlay(track)}>
      <Text style={[ds.trendRank, { color: rank <= 3 ? colors.primary : colors.mutedForeground }]}>{rank}</Text>
      <ImageBackground
        source={{ uri: artUrl }}
        style={[ds.trendArt, { backgroundColor: "#1a1a1a" }]}
        imageStyle={{ borderRadius: 8 }}
      >
        {active && (
          <View style={ds.trendPlayOverlay}>
            <Ionicons name="pause" size={14} color="#fff" />
          </View>
        )}
      </ImageBackground>
      <View style={{ flex: 1 }}>
        <Text style={[ds.trendTitle, { color: colors.foreground }]} numberOfLines={1}>{track.title}</Text>
        <Text style={[ds.trendArtist, { color: colors.mutedForeground }]} numberOfLines={1}>{track.artist}</Text>
      </View>
      <View style={ds.trendRight}>
        <Ionicons name="headset-outline" size={12} color={colors.mutedForeground} />
        <Text style={[ds.trendPlays, { color: colors.mutedForeground }]}>
          {((track.playCount ?? 0) / 1000).toFixed(1)}K
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DiscoverScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { tracks, currentTrack, isPlaying, isLoading, playTrack, playNext, addToQueue, togglePlay, nextTrack, toggleLike, likedIds } = usePlayer();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("All");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(text), 350);
  };

  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: () => searchApi({ q: debouncedQuery }),
    enabled: debouncedQuery.trim().length > 0,
    staleTime: 30 * 1000,
  });

  const { data: mostLikedRaw, isError: isMostLikedError } = useGetMostLikedTracks(
    { limit: 5 },
    { query: { queryKey: ["most-liked", 5], staleTime: 60 * 1000 } }
  );
  const mostLikedTracks = (mostLikedRaw ?? []).map((t) => ({
    ...t,
    liked: likedIds.has(t.id),
    audioUrl: t.audioUrl ?? undefined,
    coverUrl: t.coverUrl ?? undefined,
    university: t.university ?? undefined,
    likes: t.likes,
  }));

  const isSearchActive = query.trim().length > 0;

  const filtered = useMemo(() => {
    if (debouncedQuery.trim().length > 0) {
      return (searchResults?.tracks ?? []).map((t) => ({
        ...t,
        liked: likedIds.has(t.id),
        audioUrl: t.audioUrl ?? undefined,
        university: t.university ?? undefined,
      })).filter((t) => selectedGenre === "All" || t.genre === selectedGenre);
    }
    return tracks.filter((t) => selectedGenre === "All" || t.genre === selectedGenre);
  }, [tracks, likedIds, debouncedQuery, searchResults, selectedGenre]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const genreTracks = selectedGenre === "All"
    ? tracks
    : tracks.filter((t) => t.genre === selectedGenre);

  const heroTrack = genreTracks[0];
  const freshDrops = genreTracks.slice(0, 6);
  const trendingTracks = [...genreTracks].sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0)).slice(0, 5);

  const handlePlay = (track: Track, queue?: Track[]) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentTrack?.id === track.id) togglePlay();
    else playTrack(track, queue);
  };

  return (
    <View style={[ds.container, { backgroundColor: colors.background }]}>
      {/* ── Sticky search header ── */}
      <View style={[ds.topSection, { paddingTop: topPad + 8, backgroundColor: colors.background }]}>
        <Text style={[ds.screenTitle, { color: colors.foreground }]}>Discover</Text>
        <View style={[ds.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {isSearching
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Ionicons name="search" size={18} color={colors.mutedForeground} />}
          <TextInput
            style={[ds.searchInput, { color: colors.foreground }]}
            placeholder="Search tracks, artists..."
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={handleQueryChange}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(""); setDebouncedQuery(""); }} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ds.genreList}>
          {GENRES.map((genre) => (
            <Pressable
              key={genre}
              onPress={() => { if (Platform.OS !== "web") Haptics.selectionAsync(); setSelectedGenre(genre); }}
              style={[ds.genreChip, {
                backgroundColor: selectedGenre === genre ? colors.primary : colors.card,
                borderColor: selectedGenre === genre ? colors.primary : colors.border,
              }]}
            >
              <Text style={[ds.genreChipText, { color: selectedGenre === genre ? "#fff" : colors.foreground }]}>
                {genre}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {isSearchActive ? (
        /* ── Search results ── */
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 160 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <MusicCard
              track={item}
              onPlay={(t) => playTrack(t, filtered)}
              onLike={toggleLike}
              onPlayNext={playNext}
              onAddToQueue={addToQueue}
              compact
            />
          )}
          ListEmptyComponent={
            <View style={ds.empty}>
              {isSearching
                ? <ActivityIndicator color={colors.primary} />
                : <>
                    <Ionicons name="musical-notes-outline" size={48} color={colors.mutedForeground} />
                    <Text style={[ds.emptyText, { color: colors.mutedForeground }]}>No results found</Text>
                  </>}
            </View>
          }
        />
      ) : (
        /* ── Music discovery ── */
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 160 }}>
          {/* Hero track */}
          {heroTrack ? (
            <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
              <HeroCard
                track={heroTrack}
                onPlay={(t) => handlePlay(t, genreTracks)}
                isPlaying={isPlaying}
                isCurrent={currentTrack?.id === heroTrack.id}
                index={0}
              />
            </View>
          ) : selectedGenre !== "All" ? (
            <View style={[ds.empty, { marginTop: 40 }]}>
              <Ionicons name="musical-notes-outline" size={48} color={colors.mutedForeground} />
              <Text style={[ds.emptyText, { color: colors.mutedForeground }]}>
                No {selectedGenre} tracks yet
              </Text>
            </View>
          ) : null}

          {/* Now Listening on Campus */}
          <SectionHeader title="Campus Radio" onSeeAll={() => router.push("/music-feed")} />
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, gap: 18 }}
            style={{ marginBottom: 28 }}
          >
            {NOW_LISTENING_USERS.map((u, i) => (
              <NowListeningCircle
                key={u.id} user={u} track={tracks[i]}
                onPress={() => tracks[i] && handlePlay(tracks[i], tracks)}
              />
            ))}
          </ScrollView>

          {/* Fresh Drops */}
          {freshDrops.length > 0 && (
          <SectionHeader
            title={selectedGenre === "All" ? "Fresh Drops" : `Fresh ${selectedGenre}`}
            onSeeAll={() => router.push("/trending")}
          />
          )}
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            style={{ marginBottom: 28 }}
          >
            {freshDrops.map((track, i) => (
              <Pressable key={track.id} style={ds.freshCard} onPress={() => handlePlay(track, genreTracks)}>
                <ImageBackground
                  source={{ uri: getAlbumArtUrl(track.genre, i + 1) }}
                  style={[ds.freshArt, { backgroundColor: "#1a1a1a" }]}
                  imageStyle={{ borderRadius: 14 }}
                  resizeMode="cover"
                >
                  <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.55)"]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={ds.freshPlayBtn}>
                    <Ionicons name="play" size={18} color="#fff" style={{ marginLeft: 2 }} />
                  </View>
                </ImageBackground>
                <Text style={[ds.freshTitle, { color: colors.foreground }]} numberOfLines={1}>{track.title}</Text>
                <Text style={[ds.freshArtist, { color: colors.mutedForeground }]} numberOfLines={1}>{track.artist}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <Ionicons name="play-outline" size={11} color={colors.mutedForeground} />
                  <Text style={[ds.freshPlays, { color: colors.mutedForeground }]}>
                    {((track.playCount ?? 0) / 1000).toFixed(1)}K
                  </Text>
                  <Text style={[ds.freshGenre, { color: colors.primary }]}>{track.genre}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          {/* Trending */}
          {trendingTracks.length > 0 && (
          <SectionHeader
            title={selectedGenre === "All" ? "Trending Global 100" : `Trending ${selectedGenre}`}
            onSeeAll={() => router.push("/trending")}
          />
          )}
          <View style={{ paddingHorizontal: 16, marginBottom: 28 }}>
            {trendingTracks.map((track, i) => (
              <TrendingRow
                key={track.id} track={track} rank={i + 1}
                onPlay={(t) => handlePlay(t, genreTracks)}
                isCurrent={currentTrack?.id === track.id}
                isPlaying={isPlaying}
              />
            ))}
          </View>

          {/* Most Liked */}
          {(mostLikedTracks.length > 0 || isMostLikedError) && (
            <SectionHeader title="Most Liked" onSeeAll={() => router.push("/most-liked")} />
          )}
          {isMostLikedError ? (
            <View style={[ds.mostLikedError, { backgroundColor: colors.card }]}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.mutedForeground} />
              <Text style={[ds.mostLikedErrorText, { color: colors.mutedForeground }]}>
                Could not load leaderboard
              </Text>
            </View>
          ) : mostLikedTracks.length > 0 && (
            <View style={{ paddingHorizontal: 16, marginBottom: 28 }}>
              {mostLikedTracks.map((track, i) => {
                const isCurrentlyPlaying = currentTrack?.id === track.id;
                return (
                  <Pressable
                    key={track.id}
                    style={[ds.trendRow, { backgroundColor: isCurrentlyPlaying ? colors.primary + "15" : colors.card }]}
                    onPress={() => handlePlay(track, mostLikedTracks)}
                  >
                    <Text style={[ds.trendRank, { color: i < 3 ? colors.primary : colors.mutedForeground }]}>{i + 1}</Text>
                    <TrackCover
                      coverUrl={track.coverUrl}
                      coverColor={track.coverColor}
                      size={40}
                      thumbSize={80}
                      borderRadius={8}
                      iconSize={16}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[ds.trendTitle, { color: colors.foreground }]} numberOfLines={1}>{track.title}</Text>
                      <Text style={[ds.trendArtist, { color: colors.mutedForeground }]} numberOfLines={1}>{track.artist}</Text>
                    </View>
                    <View style={ds.trendRight}>
                      <Ionicons name="heart" size={12} color={colors.primary} />
                      <Text style={[ds.trendPlays, { color: colors.primary, fontWeight: "700" }]}>
                        {track.likes >= 1000 ? `${(track.likes / 1000).toFixed(1)}K` : `${track.likes}`}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Trending by Country */}
          <SectionHeader title="Trending by Country" onSeeAll={() => {}} />
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            style={{ marginBottom: 28 }}
          >
            {TRENDING_COUNTRIES.map((country) => (
              <CountryCard key={country.id} country={country} />
            ))}
          </ScrollView>

          {/* Campus Podcasts */}
          <SectionHeader title="Campus Podcasts" onSeeAll={() => {}} />
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            style={{ marginBottom: 28 }}
          >
            {CAMPUS_PODCASTS.map((pod) => (
              <PodcastCard key={pod.id} pod={pod} />
            ))}
          </ScrollView>

          {/* Explore by Vibe */}
          <SectionHeader title="Explore by Vibe" onSeeAll={() => router.push("/genres")} />
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
            style={{ marginBottom: 16 }}
          >
            {GENRE_VIBES.map((g) => (
              <Pressable
                key={g.label}
                style={[ds.vibePill, { backgroundColor: g.color + "22", borderColor: g.color + "55" }]}
                onPress={() => router.push("/genres")}
              >
                <View style={[ds.vibeDot, { backgroundColor: g.color }]} />
                <Text style={[ds.vibeLabel, { color: g.color }]}>{g.label}</Text>
                <Text style={[{ color: g.color + "aa", fontSize: 12 }]}>{g.count}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </ScrollView>
      )}

      <NowPlayingBar
        track={currentTrack}
        isPlaying={isPlaying}
        isLoading={isLoading}
        onToggle={togglePlay}
        onNext={nextTrack}
        onPress={() => router.push("/player")}
      />
    </View>
  );
}

const ds = StyleSheet.create({
  container: { flex: 1 },
  topSection: { paddingHorizontal: 20, paddingBottom: 8 },
  screenTitle: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5, marginBottom: 16 },
  searchBar: {
    flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15 },
  genreList: { paddingBottom: 12, gap: 8 },
  genreChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  genreChipText: { fontSize: 13, fontWeight: "500" },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },

  // Hero
  hero: { width: "100%", height: 210, borderRadius: 20, overflow: "hidden", justifyContent: "space-between" },
  heroPlayCount: {
    flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end", margin: 14,
    backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4,
  },
  heroPlayCountText: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "600" },
  heroBottom: { flexDirection: "row", alignItems: "flex-end", padding: 18 },
  heroBadgeRow: { flexDirection: "row", marginBottom: 6 },
  heroBadge: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  heroBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  heroTitle: { color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: -0.3, marginBottom: 2 },
  heroArtist: { color: "rgba(255,255,255,0.8)", fontSize: 14 },
  heroBtn: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center", justifyContent: "center",
  },

  // Now Listening
  nowWrap: { alignItems: "center" },
  nowOuter: { width: 72, height: 72, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  nowRing: { position: "absolute", top: 0, left: 0, width: 72, height: 72, borderRadius: 36, borderWidth: 2.5 },
  nowArt: { width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  nowLogo: { width: 46, height: 46 },
  nowBadge: {
    position: "absolute", bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11,
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff",
  },
  nowBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  nowName: { fontSize: 11, textAlign: "center" },

  // Fresh drops
  freshCard: { width: 130 },
  freshArt: { width: 130, height: 130, borderRadius: 14, alignItems: "flex-end", justifyContent: "flex-end", marginBottom: 8, overflow: "hidden" },
  freshPlayBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center", margin: 8,
  },
  freshTitle: { fontSize: 13, fontWeight: "600", marginBottom: 2 },
  freshArtist: { fontSize: 12, marginBottom: 2 },
  freshPlays: { fontSize: 11, marginRight: 4 },
  freshGenre: { fontSize: 11, fontWeight: "600" },

  // Most Liked error state
  mostLikedError: { flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: 16, marginBottom: 28, padding: 12, borderRadius: 12 },
  mostLikedErrorText: { fontSize: 13 },

  // Trending
  trendRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, marginBottom: 8, gap: 12 },
  trendRank: { width: 22, fontSize: 15, fontWeight: "800", textAlign: "center" },
  trendArt: { width: 44, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  trendPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
  },
  trendTitle: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  trendArtist: { fontSize: 12 },
  trendRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  trendPlays: { fontSize: 12 },

  // Country cards
  countryCard: { width: 130 },
  countryArt: {
    width: 130, height: 130, borderRadius: 14,
    justifyContent: "space-between",
    marginBottom: 8, overflow: "hidden",
  },
  countryStreamsTag: {
    position: "absolute", bottom: 7, right: 7,
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "rgba(0,0,0,0.50)", borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  countryStreamsText: { color: "rgba(255,255,255,0.95)", fontSize: 9, fontWeight: "700" },
  countryName: { fontSize: 13, fontWeight: "600", marginBottom: 1 },
  countryTrack: { fontSize: 11 },

  // Podcast cards — mirror freshCard layout
  podCard: { width: 130 },
  podArt: {
    width: 130, height: 130, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    marginBottom: 8, overflow: "hidden",
  },
  podNewBadge: {
    position: "absolute", top: 8, left: 8,
    backgroundColor: "#e85d4a", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  podNewText: { color: "#fff", fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  podPlayBtn: {
    position: "absolute", bottom: 8, right: 8,
    width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center",
  },
  podTitle: { fontSize: 13, fontWeight: "600", marginBottom: 2 },
  podHost: { fontSize: 12, marginBottom: 2 },
  podTypeBadge: {
    position: "absolute", top: 8, right: 8,
    backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2, maxWidth: 80,
  },
  podTypeText: { color: "#fff", fontSize: 8, fontWeight: "700", letterSpacing: 0.3 },
  podEps: { fontSize: 11 },

  // Vibe
  vibePill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  vibeDot: { width: 8, height: 8, borderRadius: 4 },
  vibeLabel: { fontSize: 14, fontWeight: "600" },
});
