import env from "$lib/env";
import { get } from "svelte/store";
import { downloadFile } from "$lib/download";
import { downloadButtonState } from "$lib/state/omnibox";
import { commandSuggestions, editableCommand, hybridSettings, lastBackendCommands, lastYtDlpJob, tiktokIdentity } from "$lib/hybrid/settings";

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
let previewGeneration = 0;

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

const requestBody = (url: string) => {
    const settings = get(hybridSettings);
    const identity = get(tiktokIdentity);
    return {
        url,
        provider: settings.provider,
        youtubeCookieProfile: settings.youtubeCookieProfile || null,
        playerClient: settings.playerClient || null,
        fetchPot: settings.fetchPot,
        potTrace: settings.potTrace,
        manualPoTokens: settings.manualPoTokens || null,
        tiktokDeviceId: identity.deviceId || null,
        tiktokAppInfo: identity.appInfo || null,
        typedOptions: settings.typedOptions,
    };
};

export const refreshCommandPreview = async (url: string) => {
    if (!useYtDlp(url)) return;
    const generation = ++previewGeneration;
    editableCommand.set("");
    commandSuggestions.set([]);
    const response = await fetch(`${env.YTDLP_API}/api/command`, {
        method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(requestBody(url)),
    });
    if (!response.ok) return;
    const preview = await response.json();
    if (generation !== previewGeneration) return;
    editableCommand.set(preview.command || "");
    commandSuggestions.set(preview.suggestions || []);
};

export const startYtDlp = async (url: string) => {
    if (!get(editableCommand).trim()) {
        throw new Error("Wait for the yt-dlp command to be generated before downloading.");
    }
    downloadButtonState.set("think");
    const response = await fetch(`${env.YTDLP_API}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ ...requestBody(url), command: get(editableCommand) }),
    });
    if (!response.ok) {
        const message = await response.json().catch(() => ({ detail: "yt-dlp request failed" }));
        downloadButtonState.set("error");
        throw new Error(message.detail || "yt-dlp request failed");
    }
    const job = await response.json();
    lastBackendCommands.set((job.commands || []).map((command: string) => ({ command, output: "", returncode: null, state: "pending" })));
    lastYtDlpJob.set(job.id);
    const deadline = Date.now() + 15 * 60 * 1000;
    let status = job;
    while (Date.now() < deadline) {
        const statusResponse = await fetch(`${env.YTDLP_API}/api/jobs/${job.id}`, {
            headers: { "Accept": "application/json" },
        });
        if (!statusResponse.ok) {
            const message = await statusResponse.json().catch(() => ({ detail: "unable to read yt-dlp job status" }));
            downloadButtonState.set("error");
            throw new Error(message.detail || "unable to read yt-dlp job status");
        }
        status = await statusResponse.json();
        lastBackendCommands.set(status.commands || []);
        if (status.state === "ready") break;
        if (status.state === "failed") {
            downloadButtonState.set("error");
            const detail = status.stderr?.trim() || `yt-dlp exited with status ${status.returncode ?? "unknown"}`;
            throw new Error(detail);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (status.state !== "ready" || !status.downloadUrl) {
        downloadButtonState.set("error");
        throw new Error("yt-dlp processing timed out before a download was ready");
    }
    downloadButtonState.set("done");
    downloadFile({ url: new URL(status.downloadUrl, env.YTDLP_API).toString() });
};
