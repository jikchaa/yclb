/* base 가 바뀌어도 링크가 깨지지 않게 한곳에서 붙인다. */
export function url(path: string): string {
  return (import.meta.env.BASE_URL + '/' + path).replace(/\/{2,}/g, '/');
}
