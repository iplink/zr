// Keep the label separate from the arrow so only the text is underlined.
export function decorateTextLinks(html) {
  return html.replace(/(<(?:a|button|span)\b[^>]*\bclass="[^"]*\b(?:text-link|house-read-more)\b[^"]*"[^>]*>)([^<]+)(?=<)/g,
    (_, tag, label) => `${tag}<span class="link-label">${label.trimEnd()}</span>${/\s$/.test(label) ? ' ' : ''}`);
}
