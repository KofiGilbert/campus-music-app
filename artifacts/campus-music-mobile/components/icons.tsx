import {
  type LucideIcon,
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Bell,
  Bookmark,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Compass,
  Eye,
  EyeOff,
  GraduationCap,
  Headphones,
  Heart,
  Home,
  Image as ImageIcon,
  Library,
  List,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Mic,
  MoreHorizontal,
  MoreVertical,
  Music,
  Music2,
  Newspaper,
  Pause,
  Pencil,
  Play,
  PlayCircle,
  Plus,
  PlusCircle,
  Radio,
  Repeat,
  Search,
  Send,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  Smartphone,
  SquarePen,
  Star,
  Ticket,
  Trash2,
  TrendingUp,
  UploadCloud,
  User,
  UserCircle2,
  UserPlus,
  Users,
  X,
  XCircle,
} from "lucide-react-native";
import type { StyleProp, ViewStyle } from "react-native";

type IconProps = {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

const IONICON_MAP = {
  add: Plus,
  "add-circle": PlusCircle,
  "add-circle-outline": PlusCircle,
  "alert-circle-outline": AlertCircle,
  "arrow-back": ArrowLeft,
  "bar-chart-outline": BarChart3,
  bookmark: Bookmark,
  "bookmark-outline": Bookmark,
  camera: Camera,
  "camera-outline": Camera,
  "chatbubble-outline": MessageCircle,
  "chatbubbles-outline": MessagesSquare,
  checkmark: Check,
  "checkmark-circle": CheckCircle2,
  "chevron-back": ChevronLeft,
  "chevron-down": ChevronDown,
  "chevron-forward": ChevronRight,
  close: X,
  "close-circle": XCircle,
  "cloud-upload-outline": UploadCloud,
  compass: Compass,
  "compass-outline": Compass,
  "create-outline": SquarePen,
  "ellipse-outline": Circle,
  "ellipsis-horizontal": MoreHorizontal,
  "ellipsis-vertical": MoreVertical,
  eye: Eye,
  "eye-off-outline": EyeOff,
  "eye-outline": Eye,
  headset: Headphones,
  "headset-outline": Headphones,
  heart: Heart,
  "heart-outline": Heart,
  home: Home,
  "home-outline": Home,
  "image-outline": ImageIcon,
  library: Library,
  "library-outline": Library,
  list: List,
  "list-outline": List,
  "location-outline": MapPin,
  "lock-closed-outline": Lock,
  "log-out-outline": LogOut,
  "mail-outline": Mail,
  mic: Mic,
  "mic-outline": Mic,
  "musical-note": Music,
  "musical-note-outline": Music,
  "musical-notes": Music2,
  "musical-notes-outline": Music2,
  "newspaper-outline": Newspaper,
  notifications: Bell,
  "notifications-outline": Bell,
  "paper-plane-outline": Send,
  pause: Pause,
  pencil: Pencil,
  people: Users,
  "people-outline": Users,
  person: User,
  "person-add": UserPlus,
  "person-add-outline": UserPlus,
  "person-circle": UserCircle2,
  "person-circle-outline": UserCircle2,
  "person-outline": User,
  "phone-portrait": Smartphone,
  "phone-portrait-outline": Smartphone,
  play: Play,
  "play-circle": PlayCircle,
  "play-circle-outline": PlayCircle,
  "play-outline": Play,
  "play-skip-back": SkipBack,
  "play-skip-forward": SkipForward,
  radio: Radio,
  "radio-outline": Radio,
  repeat: Repeat,
  "repeat-outline": Repeat,
  "school-outline": GraduationCap,
  search: Search,
  "search-outline": Search,
  send: Send,
  "share-outline": Share2,
  shuffle: Shuffle,
  star: Star,
  "star-outline": Star,
  "ticket-outline": Ticket,
  "time-outline": Clock,
  "trash-outline": Trash2,
  "trending-up-outline": TrendingUp,
} satisfies Record<string, LucideIcon>;

const FEATHER_MAP = {
  home: Home,
  "alert-circle": AlertCircle,
  x: X,
} satisfies Record<string, LucideIcon>;

const FILLED = new Set<string>([
  "heart",
  "bookmark",
  "star",
  "notifications",
  "play",
  "play-circle",
  "pause",
  "checkmark-circle",
]);

function renderIcon(
  Cmp: LucideIcon | undefined,
  name: string,
  { size = 24, color = "#000", style }: Omit<IconProps, "name">,
) {
  if (__DEV__ && !Cmp) {
    console.warn(`[icons] no SVG mapping for "${name}" — falling back to Circle`);
  }
  const Resolved = Cmp ?? Circle;
  const filled = FILLED.has(name);
  return (
    <Resolved
      size={size}
      color={color}
      fill={filled ? color : "none"}
      style={style}
    />
  );
}

export function Ionicons({ name, ...rest }: IconProps) {
  return renderIcon((IONICON_MAP as Record<string, LucideIcon>)[name], name, rest);
}
Ionicons.glyphMap = IONICON_MAP;

export function Feather({ name, ...rest }: IconProps) {
  return renderIcon((FEATHER_MAP as Record<string, LucideIcon>)[name], name, rest);
}
Feather.glyphMap = FEATHER_MAP;
