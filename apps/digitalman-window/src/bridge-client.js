export class BridgeClientError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class BridgeClient {
  constructor({ baseUrl, token, fetchImpl = fetch }) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  health() {
    return this.#request("/healthz");
  }

  createSession(options = {}) {
    return this.#request("/v1/sessions", { method: "POST", body: options });
  }

  appendMessage(sessionId, message) {
    return this.#request(`/v1/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: "POST",
      body: message
    });
  }

  endSession(sessionId) {
    return this.#request(`/v1/sessions/${encodeURIComponent(sessionId)}/end`, {
      method: "POST",
      body: {}
    });
  }

  async #request(path, { method = "GET", body } = {}) {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" })
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new BridgeClientError(payload.error?.message ?? "Bridge request failed", {
        status: response.status,
        code: payload.error?.code
      });
    }
    return payload;
  }
}
