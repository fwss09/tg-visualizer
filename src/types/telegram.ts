export interface TelegramTextEntity {
  type: string
  text: string
  href?: string
  document_id?: string
}

export type TelegramText = string | (string | TelegramTextEntity)[]

export interface TelegramReaction {
  type: string
  count: number
  emoji?: string
  recent?: Array<{ from: string; from_id: string; date: number }>
}

export interface TelegramMessage {
  id: number
  type: 'message' | 'service'
  date: string
  date_unixtime: string | number
  from?: string
  from_id?: string
  actor?: string
  actor_id?: string
  action?: string
  reply_to_message_id?: number
  text: TelegramText
  text_entities?: TelegramTextEntity[]
  media_type?: string
  photo?: string
  file?: string
  thumbnail?: string
  mime_type?: string
  duration_seconds?: number
  width?: number
  height?: number
  sticker_emoji?: string
  forwarded_from?: string
  saved_from?: string
  reactions?: TelegramReaction[]
  edited?: string
  edited_unixtime?: string | number
}

export interface TelegramExport {
  name: string
  type: string
  id: number
  messages: TelegramMessage[]
}

export interface ChatSummary {
  chatName: string
  chatType: string
  totalMessages: number
  totalCharacters: number
  totalWords: number
  dateStart: Date | null
  dateEnd: Date | null
  daysDuration: number
  participantsCount: number
  totalMedia: number
  totalVoiceNotes: number
  totalVoiceDuration: number
  totalVideoNotes: number // "Кружочки"
  totalVideoNotesDuration: number
  totalStickers: number
  totalPhotos: number
  totalVideos: number
  totalFiles: number
  totalLinks: number
  totalForwards: number
  totalReplies: number
  mostActiveDayOfWeek: string
  mostActiveHour: number
  avgMessagesPerDay: number
}

export interface ParticipantStats {
  id: string
  name: string
  messageCount: number
  characterCount: number
  wordCount: number
  avgMessageLength: number
  photosCount: number
  voiceNotesCount: number
  voiceDurationSeconds: number
  videoNotesCount: number
  videoNotesDurationSeconds: number
  stickersCount: number
  filesCount: number
  linksCount: number
  repliesCount: number
  conversationStartsCount: number
  topEmoji?: string
  percentageOfTotal: number
}

export interface TimelinePoint {
  key: string
  label: string
  total: number
  [participant: string]: number | string
}

export interface HeatmapCell {
  day: number // 0 = Mon, 6 = Sun
  dayName: string
  hour: number // 0-23
  count: number
}

export interface MediaBreakdownItem {
  name: string
  count: number
  color: string
}

export interface EmojiStat {
  emoji: string
  count: number
  byUser?: Record<string, number>
}

export interface WordStat {
  word: string
  count: number
}

export interface ReplyRelationship {
  from: string
  to: string
  count: number
}

export interface AnalyzedData {
  summary: ChatSummary
  participants: ParticipantStats[]
  timelineDays: TimelinePoint[]
  timelineWeeks: TimelinePoint[]
  timelineMonths: TimelinePoint[]
  heatmap: HeatmapCell[][] // 7 days x 24 hours
  maxHeatmapCount: number
  mediaBreakdown: MediaBreakdownItem[]
  topEmojis: EmojiStat[]
  topWords: WordStat[]
  conversationStarters: { name: string; count: number; percentage: number }[]
  replyRelationships: ReplyRelationship[]
}
