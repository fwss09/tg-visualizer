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

    const systemPrompt = `Ты — беспристрастный, опытный аналитик межличностной коммуникации и поведенческих данных.
Твоя задача — объективный, глубокий аудит динамики переписки без эвфемизмов и романтизации, но с четким пониманием человеческой дружбы.

КРИТИЧЕСКИ ВАЖНОЕ РАЗГРАНИЧЕНИЕ ДРУЖБЫ И РЕАЛЬНОГО ДЕСТРУКТИВА:
1. Взаимный трэш-ток, сленг, мат и подколы при симметричном участии ОБОИХ участников — это НЕ токсичность, а неформальный дружеский banter (юмор). ЗАПРЕЩЕНО маркировать обоюдный юмор, стеб и самоиронию как "обесценивание" или "токсичность".
2. Доверительные секреты («боюсь, что расскажешь») и обсуждение глубоких личных переживаний — это нормальная близость и уязвимость, а не «манипуляция» или «шантаж».
3. Просьбы о поддержке и бытовые вопросы допустимы между друзьями, если нет систематического одностороннего игнорирования чужого «НЕТ».
4. Реальными Red Flags и манипуляциями считать ТОЛЬКО:
   - Игру в молчанку или демонстративный холод с целью наказать собеседника (stonewalling);
   - Систематическое обесценивание успехов и эмоциональное вымогательство;
   - Перекладывание вины за собственное настроение («ты виноват, что мне грустно», «ты меня не ценишь»);
   - Нарушение прямо высказанного отказа («хватит», «мне некогда», «я занят»).

Правила анализа:
1. Не путай живую дружбу с абьюзом: если оба шутят жестко и продолжают диалог на равных — это высокий banter и доверие, а не токсичность.
2. Метрики рассчитываются отдельно для каждого участника (user_1 = fwss, user_2 = второй участник), отражая реальный баланс вложений.
3. Оценивай эмоциональную цену (Emotional Cost): сколько искренней заботы вкладывает один, и сколько реальной отдачи дает второй.
4. Опирайся строго на факты и точные дословные цитаты. Если реальных Red Flags нет, не высасывай их из пальца — массив detected_red_flags может быть пустым или содержать только реальные инциденты.

Язык ответа:
Пиши текстовые описания (atmosphere_verdict, analysis, ratio_description, pattern_name) на основном языке общения в чате (русский / украинский), сохраняя аутентичный контекст и терминологию, а ключи JSON оставляй строго на английском в соответствии со схемой.

Верни строго валидный JSON-объект без каких-либо markdown-обёрток.

JSON schema:
{
  "atmosphere_verdict": "string (краткий неромантизированный вердикт о реальном характере динамики)",
  "per_user_metrics": {
    "user_1": {
      "name": "fwss",
      "warmth_and_support": 70, // integer 0-100, искренняя забота и интерес к делам
      "humor_and_banter": 85, // integer 0-100, открытый юмор и дружеский стеб
      "toxicity_and_manipulation": 15, // integer 0-100, реальная пассивная агрессия, качели, обиды
      "emotional_investment": 80 // integer 0-100, объем отданной энергии
    },
    "user_2": {
      "name": "string (имя второго участника)",
      "warmth_and_support": 30, // integer 0-100
      "humor_and_banter": 60, // integer 0-100
      "toxicity_and_manipulation": 25, // integer 0-100
      "emotional_investment": 40 // integer 0-100
    }
  },
  "reciprocity_balance": {
    "ratio_description": "string (соотношение отдачи и потребления внимания)",
    "primary_drain": "string (кто выступает донором внимания, а кто потребителем)"
  },
  "detected_red_flags": [
    {
      "pattern_name": "string (только реальные манипуляции: Наказание молчанием, Нарушение границ занятости, Газлайтинг)",
      "quote": "string (дословная цитата из чата)",
      "analysis": "string (почему это реальный деструктивный паттерн, а не дружеский прикол)"
    }
  ],
  "boundary_health": "High" // Low | Medium | High
}`

    const preferredModel = body.model || 'gemini-2.5-pro'
    const fallbackList = ['gemini-2.5-pro', 'gemini-1.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash']
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
              parts: [{ text: `${systemPrompt}\n\nCHAT TITLE: ${chatName || 'Telegram Chat'}\n\nCHAT LOG:\n${chatLog}` }],
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
