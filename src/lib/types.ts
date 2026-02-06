export interface WebhookData {
  id: string
  bot_name: string
  link: string
  click_count: number
  timestamp: number
}

export interface WebhookState {
  items: Record<string, WebhookData>
  order: string[]
}
