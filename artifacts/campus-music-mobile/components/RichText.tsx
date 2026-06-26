import React from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { router } from "expo-router";

// Linkify @mentions and #hashtags in post/comment bodies. Mentions navigate to a
// profile lookup; hashtags navigate to search. (Server stores raw text; this is
// the client-side rendering per Phase 3 Decision E.)
const TOKEN_RE = /(@[a-zA-Z0-9_]{1,30}|#[a-zA-Z0-9_]{1,50})/g;

export function RichText({
  body,
  style,
  linkColor,
}: {
  body: string;
  style?: StyleProp<TextStyle>;
  linkColor: string;
}) {
  const parts = body.split(TOKEN_RE);
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (part.startsWith("@") && part.length > 1) {
          const username = part.slice(1);
          return (
            <Text
              key={i}
              style={{ color: linkColor, fontWeight: "600" }}
              onPress={() => router.push(`/profile/${username}`)}
            >
              {part}
            </Text>
          );
        }
        if (part.startsWith("#") && part.length > 1) {
          return (
            <Text
              key={i}
              style={{ color: linkColor, fontWeight: "600" }}
              onPress={() => router.push(`/search?tag=${part.slice(1)}`)}
            >
              {part}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}
