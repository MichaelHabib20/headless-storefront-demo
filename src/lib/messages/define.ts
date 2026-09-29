/** An area's UI strings. Arabic must have exactly the English keys (type-checked). */
export function defineMessages<T extends Record<string, string>>(messages: { en: T; ar: { [K in keyof T]: string } }) {
  return messages;
}
