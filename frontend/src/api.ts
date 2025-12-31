import { API_BASE_URL } from "./env";

type LoginPayload = {
  username: string;
  password: string;
};

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("API base URL is not configured");
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include", // IMPORTANT for JWT cookies
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    let msg = res.statusText;
    try {
      const data = await res.json();
      msg = data?.message || msg;
    } catch {
      // ignore JSON parse error
    }
    throw new Error(msg);
  }

  return res.json();
}

// ✅ Admin login (USED BY AdminLoginPage.tsx)
export async function adminLogin(payload: LoginPayload) {
  return request<{ token?: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
