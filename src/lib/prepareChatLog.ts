import type { TelegramExport } from '@/types/telegram'
import { extractMessageText, isVoiceMessage, isVideoNote, isPhoto, isVideo, isSticker } from './analyzer'

/**
 * Converts raw Telegram message array into an ultra-compact text dialogue log for LLMs.
 * Removes heavy metadata (dimensions, photo thumbs, sticker ids), retaining timestamps, authors, reply targets, and message essence.
 * 
 * Example output:
 * [2024-02-15 14:02] Alex: Hey guys!
 * [2024-02-15 14:03] Maria (in reply to Alex): Hey! How's the project going?
 * [2024-02-15 14:04] Alex: [Voice message, 15s]
 */
export function prepareChatLogForAI(
  exportData: TelegramExport,
  maxMessagesLimit = 8000
): { logText: string; totalMessages: number; exportedMessages: number } {
  const allMessages = exportData.messages || []

  // Fast map messageId -> authorName for replies
  const authorMap = new Map<number, string>()
  for (const m of allMessages) {
    if (m.from) {
      authorMap.set(m.id, m.from)
    }
  }

  // Filter significant messages
  const validMessages = allMessages.filter((m) => {
    if (m.type === 'service' && !m.text) return false
    return Boolean(m.from || m.actor || m.text)
  })

  // Take the most recent messages up to the limit
  const messagesToProcess =
    validMessages.length > maxMessagesLimit
      ? validMessages.slice(-maxMessagesLimit)
      : validMessages

  const lines: string[] = []

  for (const msg of messagesToProcess) {
    const author = msg.from || msg.actor || 'Anonymous'
    
    // Short date format: "YYYY-MM-DD HH:mm"
    const dateStr = msg.date ? msg.date.replace('T', ' ').slice(0, 16) : ''

    // Reply target
    let replyInfo = ''
    if (msg.reply_to_message_id) {
      const repliedAuthor = authorMap.get(msg.reply_to_message_id)
      if (repliedAuthor) {
        replyInfo = ` (in reply to ${repliedAuthor})`
      }
    }

    let content = extractMessageText(msg).trim()

    // If text is empty, indicate media type
    if (!content) {
      if (isVoiceMessage(msg)) {
        content = `[Voice message, ${msg.duration_seconds || 0}s]`
      } else if (isVideoNote(msg)) {
        content = `[Video note, ${msg.duration_seconds || 0}s]`
      } else if (isPhoto(msg)) {
        content = '[Photo]'
      } else if (isSticker(msg)) {
        content = `[Sticker ${msg.sticker_emoji || ''}]`
      } else if (isVideo(msg)) {
        content = '[Video]'
      } else if (msg.file) {
        content = '[File]'
      } else {
        continue
      }
    } else {
      if (isVoiceMessage(msg)) content += ` [Voice, ${msg.duration_seconds || 0}s]`
      if (isVideoNote(msg)) content += ` [Video note, ${msg.duration_seconds || 0}s]`
      if (isPhoto(msg)) content += ' [Photo]'
    }

    // Collapse multi-line breaks
    content = content.replace(/\n+/g, ' ')

    lines.push(`[${dateStr}] ${author}${replyInfo}: ${content}`)
  }

  return {
    logText: lines.join('\n'),
    totalMessages: validMessages.length,
    exportedMessages: messagesToProcess.length,
  }
}
