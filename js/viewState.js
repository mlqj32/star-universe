export const VIEW_STATE_KEY = 'starUniverseView';

export const VIEW_STATE_VERSION = 1;



function parseViewState(raw) {

  if (!raw) return null;

  const data = JSON.parse(raw);

  if (!data || data.v !== VIEW_STATE_VERSION) return null;

  if (!data.viewMode || !Array.isArray(data.camera) || !Array.isArray(data.target)) return null;

  if (data.camera.length !== 3 || data.target.length !== 3) return null;

  return data;

}



export function readViewState() {

  try {

    for (const store of [localStorage, sessionStorage]) {

      const data = parseViewState(store.getItem(VIEW_STATE_KEY));

      if (data) return data;

    }

    return null;

  } catch {

    return null;

  }

}



export function writeViewState(data) {

  const payload = JSON.stringify({ ...data, v: VIEW_STATE_VERSION });

  try {

    localStorage.setItem(VIEW_STATE_KEY, payload);

  } catch {

    /* quota / private mode */

  }

  try {

    sessionStorage.setItem(VIEW_STATE_KEY, payload);

  } catch {

    /* quota / private mode */

  }

}


