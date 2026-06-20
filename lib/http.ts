type JsonLike = Record<string, unknown> | null | string | number | boolean | unknown[];

export async function readResponseBody(response: Response): Promise<{ data: JsonLike; text: string }> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return { data: await response.json(), text: "" };
    } catch {
      return { data: null, text: "" };
    }
  }

  try {
    const text = await response.text();
    return { data: null, text };
  } catch {
    return { data: null, text: "" };
  }
}
