// Use relative path for API - works on any domain
export const API_BASE_URL = '/api';

export interface Message {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id?: number;
  title: string;
  created_at: number;
  updated_at: number;
  messageCount?: number;
}

class ApiClient {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Создать новую сессию чата
  async createSession(title: string = 'Новый чат'): Promise<{ sessionId: number }> {
    return this.request('/sessions', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  // Получить все сессии
  async getAllSessions(): Promise<ChatSession[]> {
    return this.request('/sessions');
  }

  // Получить сообщения сессии
  async getMessages(sessionId: number): Promise<Message[]> {
    return this.request(`/sessions/${sessionId}/messages`);
  }

  // Сохранить сообщение
  async saveMessage(sessionId: number, role: 'user' | 'assistant', content: string): Promise<{ messageId: number }> {
    return this.request('/messages', {
      method: 'POST',
      body: JSON.stringify({ sessionId, role, content }),
    });
  }

  // Обновить заголовок сессии
  async updateSessionTitle(sessionId: number, title: string): Promise<{ success: boolean }> {
    return this.request(`/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });
  }

  // Удалить сессию
  async deleteSession(sessionId: number): Promise<{ success: boolean }> {
    return this.request(`/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request('/health');
  }
}

export const apiClient = new ApiClient();
