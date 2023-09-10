

export function setUrlParam(key: string, value: string) {
    let params = new URLSearchParams(window.location.search);
    params.set(key, value);
    window.history.replaceState(null, null, `?${params.toString()}`);
};

export function removeUrlParam(key: string) {
    let params = new URLSearchParams(window.location.search);
    params.delete(key);
    window.history.replaceState(null, null, `?${params.toString()}`);
}
