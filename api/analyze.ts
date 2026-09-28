export const config = {
  maxDuration: 60,
}

interface RequestBody {
  chatName?: string
  chatLog: string
  apiKey?: string
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

    const systemPrompt = `Ты — беспристрастный, критический аналитик межличностной коммуникации и поведенческих данных.
Твоя задача — объективный, холодный аудит динамики переписки без эвфемизмов, вежливого сглаживания и романтизации.

Правила анализа:
1. Запрещено романтизировать токсичность: наигранные обиды, капризы и мини-драмы — это не «милый флирт», а эмоциональный вампиризм и попытка удержания контроля.
2. Метрики ВСЕГДА рассчитываются отдельно для каждого участника, чтобы объективно отразить баланс/дисбаланс. Если участников двое, один из них — fwss (user_1), а второй — собеседник (user_2).
3. Оценивай эмоциональную цену (Emotional Cost): сколько усилий и заботы вкладывает один участник, и сколько реальной отдачи (а не формальных смайлов/реакций) дает второй.
4. Фиксируй реакцию на границы: как собеседник реагирует на фразы «я занят», «мне нужно работать/учиться» (пассивная агрессия, холод, обесценивание, демонстративные закрытия).
5. Будь строг, опирайся только на факты и точные цитаты из лога.

Язык ответа:
Пиши текстовые описания (atmosphere_verdict, analysis, ratio_description, pattern_name) на основном языке общения в чате (русский / украинский), сохраняя точный контекст и терминологию, а ключи JSON оставляй строго на английском в соответствии со схемой.

Верни строго валидный JSON-объект без каких-либо markdown-обёрток.

JSON schema:
{
  "atmosphere_verdict": "string (краткий неромантизированный вердикт о реальном характере динамики)",
  "per_user_metrics": {
    "user_1": {
      "name": "fwss",
      "warmth_and_support": 70, // integer 0-100, искренняя забота и интерес к делам
      "humor_and_banter": 85, // integer 0-100, открытый юмор без скрытых уколов
      "toxicity_and_manipulation": 15, // integer 0-100, пассивная агрессия, качели, обиды
      "emotional_investment": 80 // integer 0-100, объем отданной энергии
    },
    "user_2": {
      "name": "string (имя второго участника)",
      "warmth_and_support": 30, // integer 0-100
      "humor_and_banter": 60, // integer 0-100
      "toxicity_and_manipulation": 75, // integer 0-100
      "emotional_investment": 40 // integer 0-100
    }
  },
  "reciprocity_balance": {
    "ratio_description": "string (соотношение отдачи и потребления внимания)",
    "primary_drain": "string (кто выступает донором внимания, а кто потребителем)"
  },
  "detected_red_flags": [
    {
      "pattern_name": "string (например: Пассивно-агрессивное закрытие диалога, Подвешивание неопределенности)",
      "quote": "string (дословная цитата из чата)",
      "analysis": "string (почему это манипулятивный хук)"
    }
  ],
  "boundary_health": "Low" // Low | Medium | High
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
              parts: [{ text: `${systemPrompt}\n\nCHAT TITLE: ${chatName || 'Telegram Chat'}\n\nCHAT LOG:\n${chatLog}` }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.3, // Более строгая и точная температура без галлюцинаций
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
