// Use relative path for API - works on any domain
export const API_BASE_URL = '/api';

export interface Message {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  artifactId?: number;
}

export interface ChatSession {
  id?: number;
  title: string;
  created_at: number;
  updated_at: number;
  messageCount?: number;
}

export interface Artifact {
  id?: number;
  sessionId: number;
  type: 'website';
  title: string;
  files: Record<string, string>;
  deps?: Record<string, string>;
  createdAt: number;
  updatedAt: number;
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
  async saveMessage(sessionId: number, role: 'user' | 'assistant', content: string, artifactId?: number): Promise<{ messageId: number }> {
    return this.request('/messages', {
      method: 'POST',
      body: JSON.stringify({ sessionId, role, content, artifactId }),
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

  // Generic GET method
  async get<T>(endpoint: string): Promise<T> {
    return this.request(endpoint);
  }

  // Generic POST method
  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // === Artifacts API ===

  // Создать артефакт
  async createArtifact(
    sessionId: number,
    type: 'website',
    title: string,
    files: Record<string, string>,
    deps?: Record<string, string>
  ): Promise<{ artifactId: number }> {
    return this.request('/artifacts', {
      method: 'POST',
      body: JSON.stringify({ sessionId, type, title, files, deps }),
    });
  }

  // Получить артефакт по ID
  async getArtifact(artifactId: number): Promise<Artifact> {
    return this.request(`/artifacts/${artifactId}`);
  }

  // Обновить артефакт
  async updateArtifact(
    artifactId: number,
    title: string,
    files: Record<string, string>,
    deps?: Record<string, string>
  ): Promise<{ success: boolean }> {
    return this.request(`/artifacts/${artifactId}`, {
      method: 'PUT',
      body: JSON.stringify({ title, files, deps }),
    });
  }

  // Получить все артефакты сессии
  async getArtifactsBySession(sessionId: number): Promise<Artifact[]> {
    return this.request(`/sessions/${sessionId}/artifacts`);
  }
}

export const apiClient = new ApiClient();
