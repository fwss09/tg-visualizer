export const config = {
  maxDuration: 60,
}

interface RequestBody {
  chatName?: string
  chatLog: string
  apiKey?: string
}

export default async function handler(req: Request): Promise<Response> {
  // CORS preflight
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

    const systemPrompt = `You are an expert conversational psychologist, sociologist, and witty dialogue analyst.
You are provided with a text log export from a Telegram chat titled "${chatName || 'Telegram Chat'}".
Your goal is to conduct a deep, perceptive, slightly witty, yet friendly analysis of the group dynamics, chat vibe, and key participants.

IMPORTANT LANGUAGE INSTRUCTION:
Write the textual content (archetypes, descriptions, topics, awards) in the primary language used in the chat (e.g., if the participants speak Russian/Ukrainian, write the analysis in Russian/Ukrainian with their natural slang and flavor; if English, write in English). Keep the JSON keys strictly as requested in the schema.

Return strictly a valid JSON object without any markdown code fences.

JSON format:
{
  "chatVibe": "Concise summary of the overall atmosphere and vibe (2-3 sentences)",
  "vibeScore": {
    "warmth": 85, // warmth, support and bonding from 0 to 100
    "humor": 90, // humor, banter and meme frequency from 0 to 100
    "toxicity": 10 // perceived toxicity, sarcasm or friction from 0 to 100
  },
  "dialogueDynamics": "Description of conversation formats: rapid-fire ping-pong, voice-note exchanges, monologues, who supports whom",
  "humorAndStyle": "Humor style, recurring slang, inside jokes, and linguistic quirks in this group",
  "insideJokesAndTopics": [
    {
      "topic": "Name of recurring topic, event, or inside joke",
      "summary": "Brief explanation of what it was and why it mattered"
    }
  ],
  "participants": [
    {
      "name": "Participant name",
      "archetype": "Catchy, witty title/role (e.g., 'The Night Philosopher', 'The Voice Note Maestro', 'The Drama Queen')",
      "characterAnalysis": "Personality and conversational style summary (2-3 sentences)",
      "favoriteHabit": "Prominent habit (e.g., always sends voice notes, replies with questions, uses CAPS)",
      "sampleQuote": "Characteristic quote or representative catchphrase from the chat"
    }
  ],
  "funAwards": [
    {
      "nomination": "Creative award title (e.g., 'Master of Banter', 'Night Owl of the Year')",
      "winner": "Winner name",
      "reason": "Why this participant deserves this award"
    }
  ]
}`

    const modelsToTry = ['gemini-2.5-flash', 'gemini-3.8-flash']
    let lastError: string | null = null

    for (const model of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\nCHAT LOG:\n${chatLog}` }],
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
        lastError = `Model ${model} is currently overloaded (${response.status})`
        continue
      }

      if (!response.ok) {
        const errText = await response.text()
        console.error(`Gemini Error (${model}):`, errText)
        lastError = errText
        continue
      }

      const data = await response.json()
      let rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text

      if (!rawContent) {
        lastError = `Model ${model} returned empty content.`
        continue
      }

      rawContent = rawContent.trim()
      if (rawContent.startsWith('```json')) rawContent = rawContent.slice(7)
      if (rawContent.startsWith('```')) rawContent = rawContent.slice(3)
      if (rawContent.endsWith('```')) rawContent = rawContent.slice(0, -3)

      const parsedJSON = JSON.parse(rawContent)

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
        error: lastError || 'Failed to receive a valid response from Gemini models. Please try again shortly.',
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
