export class BoundedRequestBodyError extends Error {
  constructor(public readonly code: "too_large" | "invalid_encoding") {
    super(code === "too_large" ? "Request body is too large" : "Request body is not valid UTF-8");
    this.name = "BoundedRequestBodyError";
  }
}

export async function readBoundedByteStream(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError("maxBytes must be a positive safe integer");
  }
  if (!stream) {
    return new Uint8Array();
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let byteCount = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      byteCount += value.byteLength;
      if (byteCount > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new BoundedRequestBodyError("too_large");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof BoundedRequestBodyError) throw error;
    throw new BoundedRequestBodyError("invalid_encoding");
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(byteCount);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function readBoundedUtf8Stream(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number
) {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    return decoder.decode(await readBoundedByteStream(stream, maxBytes));
  } catch (error) {
    if (error instanceof BoundedRequestBodyError) {
      throw error;
    }
    throw new BoundedRequestBodyError("invalid_encoding");
  }
}
