export const VIEW_STATE_KEY = 'starUniverseView';
export const VIEW_STATE_VERSION = 1;

export function readViewState() {
  try {
    const raw = localStorage.getItem(VIEW_STATE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== VIEW_STATE_VERSION) return null;
    if (!data.viewMode || !Array.isArray(data.camera) || !Array.isArray(data.target)) return null;
    if (data.camera.length !== 3 || data.target.length !== 3) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeViewState(data) {
  try {
    localStorage.setItem(VIEW_STATE_KEY, JSON.stringify({ ...data, v: VIEW_STATE_VERSION }));
  } catch {
    /* quota / private mode */
  }
}
