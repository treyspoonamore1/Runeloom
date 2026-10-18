/** Bottom-right toast that fades after 3 s. */
export function showToast(root: HTMLElement, text: string, ms = 3000): void {
  let host = root.querySelector<HTMLElement>(':scope > .dbg-toasts');
  if (!host) {
    host = document.createElement('div');
    host.className = 'dbg-toasts';
    root.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = 'dbg-toast';
  el.textContent = text;
  host.appendChild(el);
  setTimeout(() => el.classList.add('dbg-toast-out'), ms - 400);
  setTimeout(() => el.remove(), ms);
}
