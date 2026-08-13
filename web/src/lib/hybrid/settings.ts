import { browser } from "$app/environment";
import { writable } from "svelte/store";

export type Processor = "automatic" | "cobalt" | "yt-dlp";
export type PoTokenProvider = "automatic" | "manual" | "disabled";

export type HybridSettings = {
    processor: Processor;
    provider: PoTokenProvider;
    youtubeCookieProfile: string;
    playerClient: string;
    fetchPot: "auto" | "always" | "never";
    potTrace: boolean;
    manualPoTokens: string;
    typedOptions: Record<string, boolean | string | string[]>;
};

export type YtDlpAttempt = {
    command: string;
    output: string;
    returncode: number | null;
    state: "pending" | "running" | "succeeded" | "failed";
};

export type TikTokIdentity = {
    deviceId: string;
    appInfo: string;
};

export type CommandSuggestion = { label: string; command: string };

const defaults: HybridSettings = {
    processor: "automatic",
    provider: "disabled",
    youtubeCookieProfile: "",
    playerClient: "",
    fetchPot: "auto",
    potTrace: false,
    manualPoTokens: "",
    typedOptions: {},
};

const load = (): HybridSettings => {
    if (!browser) return defaults;
    try {
        const stored = JSON.parse(localStorage.getItem("fetch-settings") || "{}");
        return {
            ...defaults,
            ...stored,
            youtubeCookieProfile: stored.youtubeCookieProfile ?? stored.cookieProfile ?? "",
            playerClient: stored.playerClient === "mweb" && stored.provider === "automatic" ? "" : (stored.playerClient ?? ""),
            provider: stored.provider === "automatic" ? "disabled" : (stored.provider ?? "disabled"),
        };
    } catch {
        return defaults;
    }
};

export const hybridSettings = writable<HybridSettings>(load());
export const editableCommand = writable("");
export const commandSuggestions = writable<CommandSuggestion[]>([]);
export const lastBackendCommands = writable<YtDlpAttempt[]>([]);
export const tiktokIdentity = writable<TikTokIdentity>({ deviceId: "", appInfo: "" });
export const lastYtDlpJob = writable("");

if (browser) {
    hybridSettings.subscribe((value) => {
        localStorage.setItem("fetch-settings", JSON.stringify(value));
    });
}
