<script lang="ts">
    import env from "$lib/env";
    import { onMount } from "svelte";
    import { hybridSettings } from "$lib/hybrid/settings";

    type Choice = { value: string; label: string };
    type Option = { id: string; flags: string[]; control: string; label: string; tooltip: string; values?: Choice[]; values_from?: string };
    type Group = { id: string; label: string; description: string; options: Option[] };
    type Capabilities = { ytDlpVersion?: string; impersonationTargets?: Choice[]; poTokenProviders?: string[] };

    let profiles: string[] = [];
    let profileName = "youtube";
    let cookieFile: File | undefined;
    let capabilities: Capabilities = {};
    let catalog: { groups?: Group[] } = {};
    let message = "";

    const refresh = async () => {
        const cookies = await fetch(`${env.YTDLP_API}/api/cookies`).then((r) => r.json());
        profiles = cookies.profiles || [];
        capabilities = await fetch(`${env.YTDLP_API}/api/capabilities`).then((r) => r.json());
        catalog = await fetch(`${env.YTDLP_API}/api/settings/catalog`).then((r) => r.json());
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
        message = response.ok ? "Cookie profile stored." : "Cookie profile upload failed.";
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
    <label>Device ID<input bind:value={$hybridSettings.tiktokDeviceId} inputmode="numeric" autocomplete="off" /></label>
    <label>App info<input bind:value={$hybridSettings.tiktokAppInfo} autocomplete="off" placeholder="install_id/app_name/app_version/manifest_version/aid" /></label>
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
