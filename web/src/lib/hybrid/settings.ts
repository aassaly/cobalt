import { browser } from "$app/environment";
import { writable } from "svelte/store";

export type Processor = "automatic" | "cobalt" | "yt-dlp";
export type PoTokenProvider = "automatic" | "manual" | "disabled";

export type HybridSettings = {
    processor: Processor;
    globalArguments: string;
    provider: PoTokenProvider;
    youtubeCookieProfile: string;
    playerClient: string;
    fetchPot: "auto" | "always" | "never";
    potTrace: boolean;
    manualPoTokens: string;
    typedOptions: Record<string, boolean | string | string[]>;
    tiktokDeviceId: string;
    tiktokAppInfo: string;
};

export type YtDlpAttempt = {
    command: string;
    output: string;
    returncode: number | null;
    state: "pending" | "running" | "succeeded" | "failed";
};

const defaults: HybridSettings = {
    processor: "automatic",
    globalArguments: "",
    provider: "disabled",
    youtubeCookieProfile: "",
    playerClient: "",
    fetchPot: "auto",
    potTrace: false,
    manualPoTokens: "",
    typedOptions: {},
    tiktokDeviceId: "",
    tiktokAppInfo: "",
};

const load = (): HybridSettings => {
    if (!browser) return defaults;
    try {
        const stored = JSON.parse(localStorage.getItem("fetch-settings") || "{}");
        return {
            ...defaults,
            ...stored,
            globalArguments: stored.globalArguments ?? stored.rawArguments ?? "",
            youtubeCookieProfile: stored.youtubeCookieProfile ?? stored.cookieProfile ?? "",
            playerClient: stored.playerClient === "mweb" && stored.provider === "automatic" ? "" : (stored.playerClient ?? ""),
            provider: stored.provider === "automatic" ? "disabled" : (stored.provider ?? "disabled"),
        };
    } catch {
        return defaults;
    }
};

export const hybridSettings = writable<HybridSettings>(load());
export const perDownloadArguments = writable("");
export const lastBackendCommands = writable<YtDlpAttempt[]>([]);
export const lastYtDlpJob = writable("");

if (browser) {
    hybridSettings.subscribe((value) => {
        localStorage.setItem("fetch-settings", JSON.stringify(value));
    });
}
