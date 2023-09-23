import { createClient, PhotosWithTotalResults } from "pexels";
import { animalIcons } from "../render/Animals";
import { fetchImageAsDataURL } from "../util/ImageUtils";

export class PexelsImageSearch {

    static apiKey: string;

    static async findImage(query: string, orientation: 'landscape' | 'portrait') {
        // TODO: Use env for key (and think about how to not compile it...)
        let client = createClient(PexelsImageSearch.apiKey);
        let resultsOrError;
        try {
            resultsOrError = await client.photos.search({query, orientation: orientation});
        } catch (e) {
            console.error(e);
            return null;
        }
        if (resultsOrError instanceof Error) {
            console.error(resultsOrError);
            return null;
        }
        let results = resultsOrError as PhotosWithTotalResults;
        let filtered = results.photos.filter(photo => {
            let ratio = photo.width / photo.height;
            if (orientation === 'portrait') ratio = 1 / ratio;
            if (ratio < 1.3 || ratio > 1.7) return false;
            return true;
        });
        if (filtered.length === 0) return null;
        return filtered[0].src.large;
    }

    static async downloadImage(name: string, url: string) {
        const link = document.createElement("a");
        let internal = await fetchImageAsDataURL(url);
        if (internal === null) return;
        link.href = internal;
        link.download = name;
        link.click();
    }

    static async searchAndDownload(query: string, orientation: 'landscape' | 'portrait', name = query) {
        let url = await PexelsImageSearch.findImage(query, orientation);
        if (url === null) {
            console.error('no image found');
            return;
        }
        await PexelsImageSearch.downloadImage(name.replace(" ", "-"), url);
    }

    static async downloadAllImages(orientation: 'landscape' | 'portrait') {
        let animals = animalIcons.split('\n');
        for (let i = 0; i < animals.length; i++) {
            let animal = animals[i];
            let name = animal.replace(".png", "");
            let search = name;
            await PexelsImageSearch.searchAndDownload(search, orientation, name);
        };
    }
}