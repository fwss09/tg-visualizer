import type { TelegramExport } from '@/types/telegram'
import { extractMessageText, isVoiceMessage, isVideoNote, isPhoto, isVideo, isSticker } from './analyzer'

/**
 * Converts raw Telegram message array into an ultra-compact text dialogue log for LLMs.
 * Processes 100% of messages without artificial slicing limits.
 */
export function prepareChatLogForAI(
  exportData: TelegramExport
): { logText: string; totalMessages: number; exportedMessages: number } {
  const allMessages = exportData.messages || []

  // Fast map messageId -> authorName for replies
  const authorMap = new Map<number, string>()
  for (const m of allMessages) {
    if (m.from) {
      authorMap.set(m.id, m.from)
    }
  }

  // Filter out empty service actions (keep messages with text, media, or sender)
  const validMessages = allMessages.filter((m) => {
    if (m.type === 'service' && !m.text && !m.action) return false
    return Boolean(m.from || m.actor || m.text)
  })

  const lines: string[] = []

  for (const msg of validMessages) {
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
    totalMessages: allMessages.length,
    exportedMessages: lines.length,
  }
}
