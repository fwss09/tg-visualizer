import type {
  TelegramExport,
  TelegramMessage,
  AnalyzedData,
  ChatSummary,
  ParticipantStats,
  TimelinePoint,
  HeatmapCell,
  MediaBreakdownItem,
  EmojiStat,
  WordStat,
  ReplyRelationship,
} from '@/types/telegram'

// Common English and Russian stop words to filter out from keyword frequency
const STOP_WORDS = new Set([
  // English
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on',
  'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we',
  'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
  'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when',
  'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into',
  'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now',
  'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two',
  'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any',
  'these', 'give', 'day', 'most', 'us', 'are', 'was', 'were', 'been', 'has', 'had', 'is',
  'dont', 'did', 'does', 'didnt', 'doesnt', 'cant', 'wont', 'yeah', 'yes', 'yep', 'nope',
  'okay', 'thanks', 'thank', 'please', 'sorry', 'really', 'much', 'more',
  // Russian
  'и', 'в', 'не', 'на', 'я', 'что', 'с', 'по', 'а', 'как', 'это', 'но', 'к', 'у', 'ты',
  'за', 'от', 'из', 'так', 'же', 'о', 'или', 'бы', 'то', 'мы', 'вы', 'он', 'она', 'они',
  'мне', 'меня', 'тебе', 'тебя', 'его', 'ее', 'её', 'их', 'нас', 'вам', 'ему', 'ей',
  'им', 'тут', 'там', 'где', 'куда', 'когда', 'кто', 'чем', 'все', 'всё', 'всех', 'всем',
  'даже', 'тоже', 'еще', 'ещё', 'уже', 'только', 'вот', 'если', 'нет', 'да', 'ну', 'ли',
  'было', 'быть', 'был', 'была', 'будет', 'есть', 'очень', 'просто', 'сейчас', 'потом',
  'надо', 'можно', 'через', 'после', 'для', 'под', 'над', 'при', 'без', 'до', 'про',
  'сам', 'сама', 'сами', 'само', 'тот', 'та', 'те', 'то', 'этот', 'эта', 'эти', 'этом',
  'хотя', 'ведь', 'разве', 'неужели', 'почему', 'зачем', 'может', 'будто', 'точно',
  'вообще', 'кстати', 'ладно', 'типа', 'короче', 'блин', 'ок', 'норм', 'спасибо', 'пожалуйста',
])

export function extractMessageText(msg: TelegramMessage): string {
  if (typeof msg.text === 'string') {
    return msg.text
  }
  if (Array.isArray(msg.text)) {
    return msg.text
      .map((part) => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object' && 'text' in part) return String(part.text)
        return ''
      })
      .join('')
  }
  return ''
}

export function isVideoNote(msg: TelegramMessage): boolean {
  return (
    msg.media_type === 'video_message' ||
    msg.media_type === 'round_video' ||
    (msg.media_type === 'video_file' && msg.width === msg.height && (msg.duration_seconds || 0) <= 60)
  )
}

export function isVoiceMessage(msg: TelegramMessage): boolean {
  return msg.media_type === 'voice_message'
}

export function isSticker(msg: TelegramMessage): boolean {
  return msg.media_type === 'sticker' || Boolean(msg.sticker_emoji)
}

export function isPhoto(msg: TelegramMessage): boolean {
  return Boolean(msg.photo) || msg.media_type === 'photo'
}

export function isVideo(msg: TelegramMessage): boolean {
  return (
    (msg.media_type === 'video_file' || msg.media_type === 'animation') &&
    !isVideoNote(msg)
  )
}

export function hasLink(msg: TelegramMessage, text: string): boolean {
  if (msg.text_entities?.some((e) => e.type === 'link' || e.type === 'url')) {
    return true
  }
  return /https?:\/\/[^\s]+/i.test(text)
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function analyzeTelegramData(
  data: TelegramExport,
  filter?: {
    startDate?: Date | null
    endDate?: Date | null
    participantId?: string | null
  }
): AnalyzedData {
  const allMessages = data.messages || []

  // Fast mapping: messageId -> authorName for replies calculation
  const messageAuthors = new Map<number, string>()
  for (const m of allMessages) {
    if (m.from) {
      messageAuthors.set(m.id, m.from)
    }
  }

  // Filter messages
  const filteredMessages = allMessages.filter((msg) => {
    // Only real messages, skip service events if they have no sender
    if (msg.type === 'service' && !msg.from && !msg.actor) return false

    const msgDate = new Date(msg.date)
    if (isNaN(msgDate.getTime())) return false

    if (filter?.startDate && msgDate < filter.startDate) return false
    if (filter?.endDate && msgDate > filter.endDate) return false

    const senderId = msg.from_id || msg.actor_id || msg.from || 'unknown'
    if (filter?.participantId && filter.participantId !== 'all' && senderId !== filter.participantId) {
      return false
    }

    return true
  })

  // Basic counters
  let totalCharacters = 0
  let totalWords = 0
  let totalVoiceNotes = 0
  let totalVoiceDuration = 0
  let totalVideoNotes = 0
  let totalVideoNotesDuration = 0
  let totalStickers = 0
  let totalPhotos = 0
  let totalVideos = 0
  let totalFiles = 0
  let totalLinks = 0
  let totalForwards = 0
  let totalReplies = 0

  // Participant aggregators
  const participantMap = new Map<string, ParticipantStats>()

  // Timeline aggregators
  const dayBuckets = new Map<string, { count: number; date: Date; participants: Record<string, number> }>()
  const weekBuckets = new Map<string, { count: number; label: string; participants: Record<string, number> }>()
  const monthBuckets = new Map<string, { count: number; label: string; participants: Record<string, number> }>()

  // Heatmap: 7 days x 24 hours
  const heatmapGrid: HeatmapCell[][] = Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 24 }, (_, h) => ({
      day: d,
      dayName: DAY_NAMES[d],
      hour: h,
      count: 0,
    }))
  )

  // Conversation starters: gap > 4 hours (14400000 ms)
  const CONVERSATION_GAP_MS = 4 * 60 * 60 * 1000
  let lastMessageTime: number | null = null
  const conversationStartersMap = new Map<string, number>()

  // Replies map: "from -> to" -> count
  const replyMap = new Map<string, number>()

  // Emoji frequency map
  const emojiMap = new Map<string, { count: number; byUser: Record<string, number> }>()
  const emojiRegex = /\p{Extended_Pictographic}/gu

  // Word frequency map
  const wordMap = new Map<string, number>()

  let minDate: Date | null = null
  let maxDate: Date | null = null

  // Sort chronologically for conversation starters and timeline
  filteredMessages.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  for (const msg of filteredMessages) {
    const senderName = msg.from || msg.actor || 'Unknown'
    const senderId = msg.from_id || msg.actor_id || senderName
    const msgDate = new Date(msg.date)
    const timeMs = msgDate.getTime()

    if (!minDate || msgDate < minDate) minDate = msgDate
    if (!maxDate || msgDate > maxDate) maxDate = msgDate

    const text = extractMessageText(msg)
    const chars = text.length
    const words = text ? text.trim().split(/\s+/).filter(Boolean).length : 0

    totalCharacters += chars
    totalWords += words

    // Media checks
    const isVNote = isVideoNote(msg)
    const isVVoice = isVoiceMessage(msg)
    const isStk = isSticker(msg)
    const isPht = isPhoto(msg)
    const isVid = isVideo(msg)
    const isFl = Boolean(msg.file) && !isVVoice && !isVNote && !isStk && !isVid
    const isLnk = hasLink(msg, text)
    const isFwd = Boolean(msg.forwarded_from || msg.saved_from)
    const isRep = Boolean(msg.reply_to_message_id)

    if (isVNote) {
      totalVideoNotes++
      totalVideoNotesDuration += msg.duration_seconds || 0
    }
    if (isVVoice) {
      totalVoiceNotes++
      totalVoiceDuration += msg.duration_seconds || 0
    }
    if (isStk) totalStickers++
    if (isPht) totalPhotos++
    if (isVid) totalVideos++
    if (isFl) totalFiles++
    if (isLnk) totalLinks++
    if (isFwd) totalForwards++
    if (isRep) totalReplies++

    // Conversation starters
    if (lastMessageTime === null || timeMs - lastMessageTime > CONVERSATION_GAP_MS) {
      conversationStartersMap.set(
        senderName,
        (conversationStartersMap.get(senderName) || 0) + 1
      )
    }
    lastMessageTime = timeMs

    // Reply network
    if (msg.reply_to_message_id) {
      const repliedAuthor = messageAuthors.get(msg.reply_to_message_id)
      if (repliedAuthor && repliedAuthor !== senderName) {
        const key = `${senderName} ➔ ${repliedAuthor}`
        replyMap.set(key, (replyMap.get(key) || 0) + 1)
      }
    }

    // Participant Stats
    let p = participantMap.get(senderId)
    if (!p) {
      p = {
        id: senderId,
        name: senderName,
        messageCount: 0,
        characterCount: 0,
        wordCount: 0,
        avgMessageLength: 0,
        photosCount: 0,
        voiceNotesCount: 0,
        voiceDurationSeconds: 0,
        videoNotesCount: 0,
        videoNotesDurationSeconds: 0,
        stickersCount: 0,
        filesCount: 0,
        linksCount: 0,
        repliesCount: 0,
        conversationStartsCount: 0,
        percentageOfTotal: 0,
      }
      participantMap.set(senderId, p)
    }

    p.messageCount++
    p.characterCount += chars
    p.wordCount += words
    if (isPht) p.photosCount++
    if (isVVoice) {
      p.voiceNotesCount++
      p.voiceDurationSeconds += msg.duration_seconds || 0
    }
    if (isVNote) {
      p.videoNotesCount++
      p.videoNotesDurationSeconds += msg.duration_seconds || 0
    }
    if (isStk) p.stickersCount++
    if (isFl) p.filesCount++
    if (isLnk) p.linksCount++
    if (isRep) p.repliesCount++

    // Heatmap (getDay(): 0 is Sunday, convert to 0=Monday..6=Sunday)
    const rawDay = msgDate.getDay()
    const dayOfWeek = rawDay === 0 ? 6 : rawDay - 1
    const hour = msgDate.getHours()
    heatmapGrid[dayOfWeek][hour].count++

    // Timeline: Day key YYYY-MM-DD
    const year = msgDate.getFullYear()
    const month = String(msgDate.getMonth() + 1).padStart(2, '0')
    const day = String(msgDate.getDate()).padStart(2, '0')
    const dayKey = `${year}-${month}-${day}`

    let dayBucket = dayBuckets.get(dayKey)
    if (!dayBucket) {
      dayBucket = { count: 0, date: msgDate, participants: {} }
      dayBuckets.set(dayKey, dayBucket)
    }
    dayBucket.count++
    dayBucket.participants[senderName] = (dayBucket.participants[senderName] || 0) + 1

    // Timeline: Month key YYYY-MM
    const monthKey = `${year}-${month}`
    let monthBucket = monthBuckets.get(monthKey)
    if (!monthBucket) {
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ]
      const label = `${monthNames[msgDate.getMonth()]} ${year}`
      monthBucket = { count: 0, label, participants: {} }
      monthBuckets.set(monthKey, monthBucket)
    }
    monthBucket.count++
    monthBucket.participants[senderName] = (monthBucket.participants[senderName] || 0) + 1

    // Timeline: Week key
    const firstDayOfYear = new Date(year, 0, 1)
    const pastDaysOfYear = (timeMs - firstDayOfYear.getTime()) / 86400000
    const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
    const weekKey = `${year}-W${String(weekNum).padStart(2, '0')}`
    let weekBucket = weekBuckets.get(weekKey)
    if (!weekBucket) {
      weekBucket = { count: 0, label: `W${weekNum}, ${year}`, participants: {} }
      weekBuckets.set(weekKey, weekBucket)
    }
    weekBucket.count++
    weekBucket.participants[senderName] = (weekBucket.participants[senderName] || 0) + 1

    // Emojis extraction from text
    const matchedEmojis = text.match(emojiRegex)
    if (matchedEmojis) {
      for (const emoji of matchedEmojis) {
        let entry = emojiMap.get(emoji)
        if (!entry) {
          entry = { count: 0, byUser: {} }
          emojiMap.set(emoji, entry)
        }
        entry.count++
        entry.byUser[senderName] = (entry.byUser[senderName] || 0) + 1
      }
    }

    // Reactions emoji
    if (msg.reactions) {
      for (const r of msg.reactions) {
        if (r.emoji) {
          let entry = emojiMap.get(r.emoji)
          if (!entry) {
            entry = { count: 0, byUser: {} }
            emojiMap.set(r.emoji, entry)
          }
          entry.count += r.count || 1
        }
      }
    }

    // Word tokens extraction
    if (text) {
      const cleanTokens = text
        .toLowerCase()
        .replace(/https?:\/\/[^\s]+/g, ' ')
        .replace(/[^\p{L}\s]/gu, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))

      for (const word of cleanTokens) {
        wordMap.set(word, (wordMap.get(word) || 0) + 1)
      }
    }
  }

  // Finalize participant stats
  const participantsList = Array.from(participantMap.values()).map((p) => {
    p.avgMessageLength = p.messageCount > 0 ? Math.round(p.characterCount / p.messageCount) : 0
    p.percentageOfTotal =
      filteredMessages.length > 0
        ? Number(((p.messageCount / filteredMessages.length) * 100).toFixed(1))
        : 0
    p.conversationStartsCount = conversationStartersMap.get(p.name) || 0
    return p
  })
  participantsList.sort((a, b) => b.messageCount - a.messageCount)

  // Top active day of week & hour
  let maxHeatmapCount = 0
  let mostActiveDayIdx = 0
  let mostActiveHour = 0
  let maxSlotCount = 0

  const dayTotals = Array(7).fill(0)
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const c = heatmapGrid[d][h].count
      dayTotals[d] += c
      if (c > maxHeatmapCount) {
        maxHeatmapCount = c
      }
      if (c > maxSlotCount) {
        maxSlotCount = c
        mostActiveDayIdx = d
        mostActiveHour = h
      }
    }
  }

  // Duration in days
  const daysDuration =
    minDate && maxDate
      ? Math.max(1, Math.round((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)))
      : 0

  // Format Timeline points
  const timelineDays: TimelinePoint[] = Array.from(dayBuckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => {
      const [y, m, d] = key.split('-')
      return {
        key,
        label: `${m}/${d}`,
        total: val.count,
        ...val.participants,
      }
    })

  const timelineWeeks: TimelinePoint[] = Array.from(weekBuckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => ({
      key,
      label: val.label,
      total: val.count,
      ...val.participants,
    }))

  const timelineMonths: TimelinePoint[] = Array.from(monthBuckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => ({
      key,
      label: val.label,
      total: val.count,
      ...val.participants,
    }))

  // Media breakdown chart data
  const totalMedia =
    totalPhotos + totalVideos + totalVoiceNotes + totalVideoNotes + totalStickers + totalFiles
  const textOnlyCount = Math.max(0, filteredMessages.length - totalMedia)

  const mediaBreakdown: MediaBreakdownItem[] = [
    { name: 'Text', count: textOnlyCount, color: '#38bdf8' },
    { name: 'Photos', count: totalPhotos, color: '#f59e0b' },
    { name: 'Video Notes', count: totalVideoNotes, color: '#10b981' },
    { name: 'Voice Messages', count: totalVoiceNotes, color: '#8b5cf6' },
    { name: 'Stickers', count: totalStickers, color: '#ec4899' },
    { name: 'Videos', count: totalVideos, color: '#f43f5e' },
    { name: 'Files', count: totalFiles, color: '#64748b' },
  ].filter((item) => item.count > 0)

  // Top emojis
  const topEmojis: EmojiStat[] = Array.from(emojiMap.entries())
    .map(([emoji, data]) => ({
      emoji,
      count: data.count,
      byUser: data.byUser,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30)

  // Assign top emoji to participants
  for (const p of participantsList) {
    let bestEmoji = ''
    let bestEmojiCount = 0
    for (const [emoji, data] of emojiMap.entries()) {
      const userCount = data.byUser[p.name] || 0
      if (userCount > bestEmojiCount) {
        bestEmojiCount = userCount
        bestEmoji = emoji
      }
    }
    p.topEmoji = bestEmoji
  }

  // Top words
  const topWords: WordStat[] = Array.from(wordMap.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 40)

  // Conversation starters list
  const totalStarts = Array.from(conversationStartersMap.values()).reduce((a, b) => a + b, 0)
  const conversationStarters = Array.from(conversationStartersMap.entries())
    .map(([name, count]) => ({
      name,
      count,
      percentage: totalStarts > 0 ? Math.round((count / totalStarts) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)

  // Reply relationships
  const replyRelationships: ReplyRelationship[] = Array.from(replyMap.entries())
    .map(([pair, count]) => {
      const [from, to] = pair.split(' ➔ ')
      return { from, to, count }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  const summary: ChatSummary = {
    chatName: data.name || 'Telegram Chat',
    chatType: data.type || 'Chat',
    totalMessages: filteredMessages.length,
    totalCharacters,
    totalWords,
    dateStart: minDate,
    dateEnd: maxDate,
    daysDuration,
    participantsCount: participantsList.length,
    totalMedia,
    totalVoiceNotes,
    totalVoiceDuration,
    totalVideoNotes,
    totalVideoNotesDuration,
    totalStickers,
    totalPhotos,
    totalVideos,
    totalFiles,
    totalLinks,
    totalForwards,
    totalReplies,
    mostActiveDayOfWeek: DAY_NAMES[mostActiveDayIdx],
    mostActiveHour,
    avgMessagesPerDay: daysDuration > 0 ? Math.round(filteredMessages.length / daysDuration) : 0,
  }

  return {
    summary,
    participants: participantsList,
    timelineDays,
    timelineWeeks,
    timelineMonths,
    heatmap: heatmapGrid,
    maxHeatmapCount,
    mediaBreakdown,
    topEmojis,
    topWords,
    conversationStarters,
    replyRelationships,
  }
}
