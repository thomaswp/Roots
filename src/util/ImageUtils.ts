
export async function fetchImageAsDataURL(url: string) {
    let response = await fetch(url);
    if (!response.ok) {
        console.error(response);
        return null;
    }
    let blob = await response.blob();
    return URL.createObjectURL(blob);
}