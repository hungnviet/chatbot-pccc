import { EXTERNAL_API } from '../constants'

type ExternalUploadResponse = {
  message: string
  filename: string
}

type ExternalChatResponse = {
  answer: string
  sources?: unknown[]
  suggestions?: string[]
  notice?: string
}

async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const url = `${EXTERNAL_API.BASE_URL}${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`External API ${path} failed: ${res.status} ${text}`)
  }
  return res.json() as Promise<TResponse>
}

async function postForm<TResponse>(path: string, form: FormData): Promise<TResponse> {
  const url = `${EXTERNAL_API.BASE_URL}${path}`
  const res = await fetch(url, {
    method: 'POST',
    body: form
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`External API ${path} failed: ${res.status} ${text}`)
  }
  return res.json() as Promise<TResponse>
}

export const externalApiClient = {
  isEnabled(): boolean {
    return EXTERNAL_API.ENABLED
  },

  async upload(file: File): Promise<ExternalUploadResponse> {
    const form = new FormData()
    form.append('file', file)
    return postForm<ExternalUploadResponse>(EXTERNAL_API.PATHS.UPLOAD, form)
  },

  async chat(query: string): Promise<ExternalChatResponse> {
    return postJson<ExternalChatResponse>(EXTERNAL_API.PATHS.CHAT, { query })
  }
}


