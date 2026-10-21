/** Decode provider SSE across arbitrary byte boundaries, including split UTF-8. */
export function chatTextStream(): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let pending = '';
  let data: string[] = [];
  let finished = false;
  const dispatch = (controller: TransformStreamDefaultController<Uint8Array>) => {
    if (!data.length || finished) return;
    const payload = data.join('\n');
    data = [];
    if (payload === '[DONE]') { finished = true; return; }
    const parsed = JSON.parse(payload);
    if (parsed.error) throw new Error('The model stream returned an error.');
    const token = parsed.choices?.[0]?.delta?.content;
    if (typeof token === 'string') controller.enqueue(encoder.encode(token));
  };
  const line = (value: string, controller: TransformStreamDefaultController<Uint8Array>) => {
    value = value.replace(/\r$/, '');
    if (!value) dispatch(controller);
    else if (value.startsWith('data:')) data.push(value.slice(5).replace(/^ /, ''));
  };
  return new TransformStream({
    transform(chunk, controller) {
      pending += decoder.decode(chunk, { stream: true });
      const lines = pending.split('\n');
      pending = lines.pop() || '';
      lines.forEach((value) => line(value, controller));
    },
    flush(controller) {
      pending += decoder.decode();
      if (pending) line(pending, controller);
      dispatch(controller);
      if (!finished) throw new Error('The model stream ended before completion.');
    },
  });
}
