import { browser } from "$app/environment";
import { writable } from "svelte/store";

export type Processor = "automatic" | "cobalt" | "yt-dlp";
export type PoTokenProvider = "automatic" | "bgutil" | "wpc" | "manual" | "disabled";

export type HybridSettings = {
    processor: Processor;
    rawArguments: string;
    provider: PoTokenProvider;
    cookieProfile: string;
    playerClient: string;
    fetchPot: "auto" | "always" | "never";
    potTrace: boolean;
    manualPoTokens: string;
};

const defaults: HybridSettings = {
    processor: "automatic",
    rawArguments: "",
    provider: "automatic",
    cookieProfile: "",
    playerClient: "mweb",
    fetchPot: "auto",
    potTrace: false,
    manualPoTokens: "",
};

const load = (): HybridSettings => {
    if (!browser) return defaults;
    try {
        return { ...defaults, ...JSON.parse(localStorage.getItem("fetch-settings") || "{}") };
    } catch {
        return defaults;
    }
};

export const hybridSettings = writable<HybridSettings>(load());
export const lastBackendCommand = writable("");
export const lastYtDlpJob = writable("");

if (browser) {
    hybridSettings.subscribe((value) => {
        localStorage.setItem("fetch-settings", JSON.stringify(value));
    });
}
