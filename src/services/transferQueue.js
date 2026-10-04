// Stop scheduling on failure, but drain in-flight work before the caller cleans up.
export async function transferQueue(count, work, concurrency = 3) {
  let next = 0, failure;
  const worker = async () => {
    while (!failure && next < count) {
      const index = next++;
      try { await work(index); } catch (error) { failure ||= error; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(count, concurrency) }, worker));
  if (failure) throw failure;
}
