<script lang="ts">
    import env from "$lib/env";
    import { onMount } from "svelte";
    import { hybridSettings, tiktokIdentity } from "$lib/hybrid/settings";

    type Choice = { value: string; label: string };
    type Option = { id: string; flags: string[]; control: string; label: string; tooltip: string; values?: Choice[]; values_from?: string };
    type Group = { id: string; label: string; description: string; options: Option[] };
    type Capabilities = { ytDlpVersion?: string; impersonationTargets?: Choice[]; poTokenProviders?: string[] };

    const knownTargets = `Chrome-133:Macos-15 Chrome-136:Macos-15 Safari-17.2:Ios-17.2 Safari-18.0:Ios-18.0 Safari-18.4:Ios-18.4 Safari-26.0:Ios-26.0 Chrome-99:Android-12 Chrome-131:Android-14 Tor-14.5:Macos-14 Edge-99:Windows-10 Edge-101:Windows-10 Firefox-133:Macos-14 Firefox-135:Macos-14 Firefox-144:Macos-26 Firefox-147:Macos-26 Safari-15.3:Macos-11 Safari-15.5:Macos-12 Safari-17.0:Macos-14 Safari-18.0:Macos-15 Safari-18.4:Macos-15 Safari-26.0:Macos-26 Safari-26.0.1:Macos-26 Chrome-99:Windows-10 Chrome-100:Windows-10 Chrome-101:Windows-10 Chrome-104:Windows-10 Chrome-107:Windows-10 Chrome-110:Windows-10 Chrome-116:Windows-10 Chrome-119:Macos-14 Chrome-120:Macos-14 Chrome-123:Macos-14 Chrome-124:Macos-14 Chrome-131:Macos-14 Chrome-142:Macos-26 Chrome-145:Macos-26 Chrome-146:Macos-26`
        .split(" ").map((value) => {
            const [client, os] = value.split(":");
            return { value, label: `${client} on ${os} (curl_cffi)` };
        });

    const knownCatalog: { groups: Group[] } = { groups: [
        { id: "format", label: "Format and quality", description: "Choose a common download goal. yt-dlp still selects the best compatible streams within that goal.", options: [
            { id: "format", flags: ["--format"], control: "select", label: "Quality", tooltip: "Best available downloads the highest-quality video and audio. Video-only and audio-only omit the other stream.", values: [
                { value: "", label: "Best available" }, { value: "bestvideo*+bestaudio/best", label: "Best video and audio" },
                { value: "bestvideo", label: "Video only" }, { value: "bestaudio", label: "Audio only" },
            ] },
        ] },
        { id: "network", label: "Browser impersonation", description: "Use only when a site treats the server's normal HTTP client differently from a browser.", options: [
            { id: "impersonate", flags: ["--impersonate"], control: "dynamic-select", label: "Impersonate", tooltip: "Choose one of the impersonation targets installed with this Fetch release. Default lets yt-dlp decide.", values_from: "impersonationTargets" },
        ] },
        { id: "subtitles", label: "Subtitles", description: "Download human-created or automatic subtitles and optionally embed them in a compatible output container.", options: [
            { id: "write_subs", flags: ["--write-subs"], control: "boolean", label: "Download subtitles", tooltip: "Downloads subtitles supplied by the publisher." },
            { id: "write_auto_subs", flags: ["--write-auto-subs"], control: "boolean", label: "Include automatic subtitles", tooltip: "Also downloads automatically generated captions when available." },
            { id: "sub_langs", flags: ["--sub-langs"], control: "select", label: "Languages", tooltip: "Select common language sets. Use advanced arguments for another yt-dlp language expression.", values: [{ value: "", label: "Site default" }, { value: "en", label: "English" }, { value: "fr", label: "French" }, { value: "en,fr", label: "English and French" }, { value: "all", label: "All available" }] },
            { id: "sub_format", flags: ["--sub-format"], control: "select", label: "Subtitle format", tooltip: "Preferred subtitle file format; yt-dlp falls back when the site does not provide it.", values: [{ value: "", label: "Best available" }, { value: "vtt", label: "WebVTT" }, { value: "srt", label: "SubRip (SRT)" }, { value: "ass", label: "ASS" }, { value: "lrc", label: "LRC" }] },
            { id: "embed_subs", flags: ["--embed-subs"], control: "boolean", label: "Embed subtitles", tooltip: "Embeds downloaded subtitles when the selected media container supports them." },
        ] },
    ] };

    let profiles: string[] = [];
    let profileName = "youtube";
    let cookieFile: File | undefined;
    const capabilities: Capabilities = { ytDlpVersion: "2026.07.04", impersonationTargets: knownTargets };
    const catalog = knownCatalog;
    let message = "";

    const refresh = async () => {
        const [cookiesResponse, identityResponse] = await Promise.all([
            fetch(`${env.YTDLP_API}/api/cookies`),
            fetch(`${env.YTDLP_API}/api/settings/tiktok-identity`),
        ]);
        if (cookiesResponse.ok) profiles = (await cookiesResponse.json()).profiles || [];
        if (identityResponse.ok) tiktokIdentity.set(await identityResponse.json());
    };

    const choices = (option: Option) => option.values_from === "impersonationTargets"
        ? [{ value: "", label: "Default (let yt-dlp decide)" }, ...(capabilities.impersonationTargets || [])]
        : (option.values || []);

    const setTyped = (id: string, value: boolean | string) => hybridSettings.update((settings) => ({
        ...settings,
        typedOptions: { ...settings.typedOptions, [id]: value },
    }));

    const uploadCookies = async () => {
        if (!cookieFile || !profileName) return;
        const data = new FormData();
        data.append("file", cookieFile);
        const response = await fetch(`${env.YTDLP_API}/api/cookies/${encodeURIComponent(profileName)}`, { method: "POST", body: data });
        const result = await response.json().catch(() => ({}));
        message = response.ok ? "Cookie profile stored." : (result.detail || `Cookie profile upload failed (${response.status}).`);
        await refresh();
    };

    const removeCookies = async (name: string) => {
        await fetch(`${env.YTDLP_API}/api/cookies/${encodeURIComponent(name)}`, { method: "DELETE" });
        hybridSettings.update((value) => ({ ...value, youtubeCookieProfile: value.youtubeCookieProfile === name ? "" : value.youtubeCookieProfile }));
        await refresh();
    };

    onMount(refresh);
</script>

<section>
    <h2>Processors</h2>
    <label>Default processor
        <select bind:value={$hybridSettings.processor}>
            <option value="automatic">Automatic</option>
            <option value="cobalt">Cobalt</option>
            <option value="yt-dlp">yt-dlp</option>
        </select>
    </label>
</section>

{#each catalog.groups || [] as group}
    <section>
        <h2>{group.label}</h2>
        <p>{group.description}</p>
        {#each group.options as option}
            {#if option.control === "boolean"}
                <label class="inline" title={option.tooltip}>
                    <input type="checkbox" checked={Boolean($hybridSettings.typedOptions[option.id])} onchange={(event) => setTyped(option.id, (event.currentTarget as HTMLInputElement).checked)} />
                    {option.label} <span class="help" aria-label={option.tooltip}>?</span>
                </label>
            {:else}
                <label title={option.tooltip}>{option.label} <span class="help" aria-label={option.tooltip}>?</span>
                    <select value={String($hybridSettings.typedOptions[option.id] || "")} onchange={(event) => setTyped(option.id, (event.currentTarget as HTMLSelectElement).value)}>
                        {#each choices(option) as choice}<option value={choice.value}>{choice.label}</option>{/each}
                    </select>
                </label>
            {/if}
        {/each}
    </section>
{/each}

<section>
    <h2>YouTube access</h2>
    <p>These controls are added only to YouTube URLs. The default leaves client selection to yt-dlp.</p>
    <label>Proof-of-origin provider
        <select bind:value={$hybridSettings.provider}>
            <option value="disabled">Disabled (plain yt-dlp)</option>
            <option value="automatic">Automatic installed providers</option>
            <option value="manual">Manual token</option>
        </select>
    </label>
    {#if $hybridSettings.provider !== "disabled"}
        <label>Player client (optional)<input bind:value={$hybridSettings.playerClient} placeholder="Leave blank for yt-dlp default" /></label>
        <label>Token fetch policy
            <select bind:value={$hybridSettings.fetchPot}><option value="auto">Automatic</option><option value="always">Always</option><option value="never">Never</option></select>
        </label>
        <label class="inline"><input type="checkbox" bind:checked={$hybridSettings.potTrace} /> Token diagnostics</label>
        {#if $hybridSettings.provider === "manual"}<label>Manual tokens<textarea rows="3" bind:value={$hybridSettings.manualPoTokens}></textarea></label>{/if}
    {/if}
    <label>YouTube cookie profile
        <select bind:value={$hybridSettings.youtubeCookieProfile}>
            <option value="">None</option>
            {#each profiles as profile}<option value={profile}>{profile}</option>{/each}
        </select>
    </label>
    <p>Use cookies only for account-restricted media. A dedicated account is safer because YouTube may restrict accounts used by downloaders.</p>
    <label>Profile name<input bind:value={profileName} pattern="[A-Za-z0-9][A-Za-z0-9._-]*" maxlength="64" /></label>
    <input type="file" accept=".txt,text/plain" onchange={(event) => cookieFile = (event.currentTarget as HTMLInputElement).files?.[0]} />
    <button onclick={uploadCookies}>Upload Netscape cookie file</button>
    {#each profiles as profile}<button class="danger" onclick={() => removeCookies(profile)}>Delete {profile}</button>{/each}
    {#if message}<p>{message}</p>{/if}
</section>

<section>
    <h2>TikTok mobile identity</h2>
    <p>The protected server identity is used automatically for TikTok only. Define both fields to override it for future downloads.</p>
    <label>Device ID<input bind:value={$tiktokIdentity.deviceId} inputmode="numeric" autocomplete="off" /></label>
    <label>App info<input bind:value={$tiktokIdentity.appInfo} autocomplete="off" placeholder="install_id/app_name/app_version/manifest_version/aid" /></label>
</section>

<section>
    <h2>Advanced yt-dlp arguments</h2>
    <p>Saved arguments are appended to every yt-dlp job. A second advanced field on the download page applies only to that URL. Output paths and config locations remain server-controlled.</p>
    <textarea rows="6" bind:value={$hybridSettings.globalArguments} spellcheck="false" placeholder={'Optional saved arguments, for example:\n--write-thumbnail'}></textarea>
    {#if capabilities.ytDlpVersion}<small>OVH yt-dlp {capabilities.ytDlpVersion}</small>{/if}
</section>

<style>
    section { display: flex; flex-direction: column; gap: 10px; padding: 14px; }
    label { display: flex; flex-direction: column; gap: 5px; color: var(--secondary); }
    label.inline { flex-direction: row; align-items: center; }
    textarea, input, select, button { border: 0; border-radius: var(--border-radius); padding: 10px; color: var(--secondary); background: var(--button); box-shadow: var(--button-box-shadow); }
    textarea { font-family: "IBM Plex Mono", monospace; white-space: pre-wrap; }
    button { cursor: pointer; }
    button.danger { color: var(--red); }
    .help { display: inline-flex; align-items: center; justify-content: center; width: 1.2rem; height: 1.2rem; border-radius: 50%; background: var(--button); cursor: help; }
</style>
