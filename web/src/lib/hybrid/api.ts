import env from "$lib/env";
import { get } from "svelte/store";
import { downloadFile } from "$lib/download";
import { downloadButtonState } from "$lib/state/omnibox";
import { hybridSettings, lastBackendCommand, lastYtDlpJob } from "$lib/hybrid/settings";

const cobaltHosts = [
    /(^|\.)youtube\.com$/i, /(^|\.)youtu\.be$/i,
    /(^|\.)tiktok\.com$/i, /(^|\.)instagram\.com$/i,
    /(^|\.)twitter\.com$/i, /(^|\.)x\.com$/i,
    /(^|\.)reddit\.com$/i, /(^|\.)vimeo\.com$/i,
    /(^|\.)facebook\.com$/i, /(^|\.)soundcloud\.com$/i,
    /(^|\.)twitch\.tv$/i, /(^|\.)bsky\.app$/i,
    /(^|\.)pinterest\.[a-z.]+$/i, /(^|\.)tumblr\.com$/i,
    /(^|\.)streamable\.com$/i, /(^|\.)snapchat\.com$/i,
];

export const useYtDlp = (url: string) => {
    const settings = get(hybridSettings);
    if (settings.processor === "yt-dlp") return true;
    if (settings.processor === "cobalt") return false;
    try {
        return !cobaltHosts.some((pattern) => pattern.test(new URL(url).hostname));
    } catch {
        return false;
    }
};

export const startYtDlp = async (url: string) => {
    const settings = get(hybridSettings);
    downloadButtonState.set("think");
    const response = await fetch(`${env.YTDLP_API}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
            url,
            rawArguments: settings.rawArguments,
            provider: settings.provider,
            cookieProfile: settings.cookieProfile || null,
            playerClient: settings.playerClient || null,
            fetchPot: settings.fetchPot,
            potTrace: settings.potTrace,
            manualPoTokens: settings.manualPoTokens || null,
        }),
    });
    if (!response.ok) {
        const message = await response.json().catch(() => ({ detail: "yt-dlp request failed" }));
        downloadButtonState.set("error");
        throw new Error(message.detail || "yt-dlp request failed");
    }
    const job = await response.json();
    lastBackendCommand.set(job.command);
    lastYtDlpJob.set(job.id);
    downloadButtonState.set("done");
    downloadFile({ url: new URL(job.downloadUrl, env.YTDLP_API).toString() });
};
