// The build injects its immutable index. Assets stay below the hosting file limit,
// while browsers keep using the normal MP4 URL and byte-range requests.
export function createMediaWorker(index) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      const media = index[url.pathname];
      if (!media) return env.ASSETS.fetch(request);
      if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
      const headers = new Headers({
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600, must-revalidate',
        ETag: `"${media.hash}"`,
      });
      if (request.headers.get('If-None-Match') === headers.get('ETag')) return new Response(null, { status: 304, headers });
      let start = 0;
      let end = media.size - 1;
      const range = request.headers.get('Range');
      const ifRange = request.headers.get('If-Range');
      let partial = false;
      if (range && (!ifRange || ifRange === headers.get('ETag'))) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match || (!match[1] && !match[2])) {
          headers.set('Content-Range', `bytes */${media.size}`);
          return new Response(null, { status: 416, headers });
        }
        if (!match[1]) start = Math.max(0, media.size - Number(match[2]));
        else {
          start = Number(match[1]);
          if (match[2]) end = Math.min(Number(match[2]), end);
        }
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= media.size) {
          headers.set('Content-Range', `bytes */${media.size}`);
          return new Response(null, { status: 416, headers });
        }
        partial = true;
        headers.set('Content-Range', `bytes ${start}-${end}/${media.size}`);
      }
      headers.set('Content-Length', String(end - start + 1));
      const responseOptions = { status: partial ? 206 : 200, headers };
      if (request.method === 'HEAD') return new Response(null, responseOptions);

      let part = Math.floor(start / media.chunkSize);
      const lastPart = Math.floor(end / media.chunkSize);
      let reader;
      let skip = 0;
      let remaining = 0;
      let canceled = false;
      const stream = new ReadableStream({
        async pull(controller) {
          try {
            while (!canceled) {
              if (!reader) {
                if (part > lastPart) { controller.close(); return; }
                const partStart = part * media.chunkSize;
                const from = Math.max(0, start - partStart);
                const to = Math.min(media.chunkSize - 1, end - partStart);
                const partUrl = new URL(media.parts[part], url);
                const response = await env.ASSETS.fetch(new Request(partUrl, { headers: { Range: `bytes=${from}-${to}` } }));
                if (!response.ok || !response.body) throw new Error('Video part unavailable');
                if (canceled) { await response.body.cancel(); return; }
                // ASSETS can return the full body if it ignores Range. Stream
                // only the needed bytes, without buffering a whole media file.
                skip = response.status === 206 ? 0 : from;
                remaining = to - from + 1;
                reader = response.body.getReader();
              }
              const result = await reader.read();
              if (canceled) return;
              if (result.done) {
                if (remaining) throw new Error('Truncated video part');
                reader = null;
                part++;
                continue;
              }
              const offset = Math.min(skip, result.value.byteLength);
              skip -= offset;
              const bytes = result.value.subarray(offset, offset + remaining);
              remaining -= bytes.byteLength;
              if (!remaining) {
                await reader.cancel();
                reader = null;
                part++;
              }
              if (bytes.byteLength) { controller.enqueue(bytes); return; }
            }
          } catch (error) {
            await reader?.cancel().catch(() => {});
            controller.error(error);
          }
        },
        async cancel() { canceled = true; await reader?.cancel(); },
      });
      if (typeof FixedLengthStream !== 'undefined') {
        const fixed = new FixedLengthStream(end - start + 1);
        // The readable side carries upstream errors to the client. Do not await
        // piping: the response consumer drives the stream with backpressure.
        stream.pipeTo(fixed.writable).catch(() => {});
        return new Response(fixed.readable, responseOptions);
      }
      return new Response(stream, responseOptions);
    },
  };
}
