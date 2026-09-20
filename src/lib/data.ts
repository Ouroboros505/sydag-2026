/** Fetch a JSON file that the Python/R side wrote into public/.
 *
 * The pipeline is: analysis writes public/<name>.json -> the app fetches it here.
 * Nothing is computed in the browser that a script could have precomputed, and
 * the app keeps working with no network because the file ships with the build.
 */
const cache = new Map<string, Promise<unknown>>()

export function loadJson<T>(name: string): Promise<T> {
  const url = `/${name.replace(/^\//, '')}`
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url).then((res) => {
        if (!res.ok) throw new Error(`${url}: ${res.status}`)
        return res.json()
      }),
    )
  }
  return cache.get(url) as Promise<T>
}
