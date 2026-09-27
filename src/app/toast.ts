import { element } from "./dom";

const TOAST_DURATION_MS = 3500;

export function showToast(message: string) {
  const toast = element("div", "app-toast", message);
  toast.setAttribute("role", "status");
  document.body.append(toast);
  setTimeout(() => toast.remove(), TOAST_DURATION_MS);
}
