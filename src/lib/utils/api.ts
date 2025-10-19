async function handleJSONResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = "Request failed";
    try {
      const errorBody = (await response.json()) as { message?: string };
      if (errorBody?.message) {
        message = errorBody.message;
      }
    } catch (error) {
      // Ignore JSON parse errors
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function requestJSON<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(endpoint, init);
  return handleJSONResponse<T>(response);
}

export async function getJSON<TResponse>(endpoint: string): Promise<TResponse> {
  return requestJSON<TResponse>(endpoint, { cache: "no-store" });
}

export async function postJSON<TResponse>(endpoint: string, payload: unknown): Promise<TResponse> {
  return requestJSON<TResponse>(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function patchJSON<TResponse>(endpoint: string, payload: unknown): Promise<TResponse> {
  return requestJSON<TResponse>(endpoint, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function deleteJSON<TResponse>(endpoint: string): Promise<TResponse> {
  return requestJSON<TResponse>(endpoint, {
    method: "DELETE",
  });
}
