export function objectToQueryString(obj1: Record<string, any>, obj2?: Record<string, any>): string {
  const queryString1 = Object.entries(obj1)
    .filter(([key, value]) => value !== null && value !== undefined && value !== 'NULL')
    .map(([key, value]) => {
      let v = value;
      if (value instanceof Date) {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, '0');
        const d = String(value.getDate()).padStart(2, '0');
        v = `${y}-${m}-${d}`;
      }
      return `${key}=${encodeURIComponent(String(v))}`;
    })
    .join('&');

  const queryString2 =
    obj2 &&
    Object.entries(obj2)
      .filter(([key, value]) => value !== null && value !== undefined && value !== 'NULL')
      .map(([key, value]) => {
        let v = value;
        if (value instanceof Date) {
          const y = value.getFullYear();
          const m = String(value.getMonth() + 1).padStart(2, '0');
          const d = String(value.getDate()).padStart(2, '0');
          v = `${y}-${m}-${d}`;
        }
        return `${key}=${encodeURIComponent(String(v))}`;
      })
      .join('&');

  return queryString2 ? `?${queryString2}&${queryString1}` : `?${queryString1}`;
}
