import { SYSTEM_PROMPT } from '../src/lib/aiPrompt'
import { parseAiAnalysisJson } from '../src/lib/aiParser'

export const config = {
  maxDuration: 60,
}

interface RequestBody {
  chatName?: string
  chatLog: string
  apiKey?: string
  model?: string
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-gemini-key',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  try {
    const body = (await req.json()) as RequestBody
    const { chatName, chatLog, apiKey: clientApiKey } = body

    const customKeyFromHeader = req.headers.get('x-gemini-key')
    const apiKey = clientApiKey || customKeyFromHeader || process.env.GEMINI_API_KEY

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            'Gemini API Key was not found. Please provide your API key in the UI settings or configure GEMINI_API_KEY in your Vercel Environment Variables.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      )
    }

    if (!chatLog || typeof chatLog !== 'string' || chatLog.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Message log (chatLog) is empty or missing.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      )
    }

    const preferredModel = body.model || 'gemini-2.5-pro'
    const fallbackList = ['gemini-2.5-pro', 'gemini-2.5-flash']
    const modelsToTry = [preferredModel, ...fallbackList.filter((m) => m !== preferredModel)]
    let lastError: string | null = null

    for (const model of modelsToTry) {
      // Vertex AI Express Mode endpoint for Google Cloud billing
      const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${apiKey}`

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${SYSTEM_PROMPT}\n\nCHAT TITLE: ${chatName || 'Telegram Chat'}\n\nCHAT LOG:\n${chatLog}` }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7,
            maxOutputTokens: 8192,
          },
        }),
      })

      if (response.status === 503 || response.status === 429) {
        lastError = `Model ${model} is currently busy (${response.status})`
        continue
      }

      if (!response.ok) {
        const errText = await response.text()
        console.error(`Gemini Error (${model}):`, errText)
        lastError = errText
        continue
      }

      const data = await response.json()
      const rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text

      if (!rawContent) {
        lastError = `Model ${model} returned empty content.`
        continue
      }

      const parsedJSON = parseAiAnalysisJson(rawContent)

      return new Response(JSON.stringify(parsedJSON), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    return new Response(
      JSON.stringify({
        error: lastError || 'Failed to receive a response from Gemini models.',
      }),
      { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  } catch (error: any) {
    console.error('Serverless Handler error:', error)
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error while analyzing chat.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  }
}
