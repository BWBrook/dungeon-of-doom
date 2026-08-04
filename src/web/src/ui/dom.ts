export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderStat(label: string, value: string | number): string {
  return `<div class="hud-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>`;
}

export function requireElement<T extends HTMLElement>(
  root: ParentNode,
  selector: string,
  constructor: new (...args: never[]) => T
): T {
  const element = root.querySelector(selector);

  if (!(element instanceof constructor)) {
    throw new Error(`App UI failed to initialize: ${selector}`);
  }

  return element;
}
