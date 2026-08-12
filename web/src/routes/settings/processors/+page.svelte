<script lang="ts">
    import env from "$lib/env";
    import { onMount } from "svelte";
    import { hybridSettings } from "$lib/hybrid/settings";

    let profiles: string[] = [];
    let profileName = "youtube";
    let cookieFile: File | undefined;
    let capabilities: Record<string, unknown> | undefined;
    let message = "";

    const refresh = async () => {
        const cookies = await fetch(`${env.YTDLP_API}/api/cookies`).then((r) => r.json());
        profiles = cookies.profiles || [];
        capabilities = await fetch(`${env.YTDLP_API}/api/capabilities`).then((r) => r.json());
    };

    const uploadCookies = async () => {
        if (!cookieFile || !profileName) return;
        const data = new FormData();
        data.append("file", cookieFile);
        const response = await fetch(`${env.YTDLP_API}/api/cookies/${encodeURIComponent(profileName)}`, {
            method: "POST",
            body: data,
        });
        message = response.ok ? "Cookie profile stored." : "Cookie profile upload failed.";
        await refresh();
    };

    const removeCookies = async (name: string) => {
        await fetch(`${env.YTDLP_API}/api/cookies/${encodeURIComponent(name)}`, { method: "DELETE" });
        hybridSettings.update((value) => ({ ...value, cookieProfile: value.cookieProfile === name ? "" : value.cookieProfile }));
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

<section>
    <h2>yt-dlp arguments</h2>
    <p>These arguments are passed directly to yt-dlp. The service appends its controlled output target and source URL.</p>
    <textarea rows="8" bind:value={$hybridSettings.rawArguments} spellcheck="false" placeholder={'--impersonate chrome\n--write-subs\n--embed-subs'}></textarea>
</section>

<section>
    <h2>YouTube proof of origin</h2>
    <label>Provider
        <select bind:value={$hybridSettings.provider}>
            <option value="automatic">Automatic: BgUtils, then WPC fallback</option>
            <option value="bgutil">BgUtils</option>
            <option value="wpc">WPC browser</option>
            <option value="manual">Manual token</option>
            <option value="disabled">Disabled</option>
        </select>
    </label>
    <label>Player client <input bind:value={$hybridSettings.playerClient} placeholder="mweb" /></label>
    <label>Fetch policy
        <select bind:value={$hybridSettings.fetchPot}>
            <option value="auto">Auto</option>
            <option value="always">Always</option>
            <option value="never">Never</option>
        </select>
    </label>
    <label class="inline"><input type="checkbox" bind:checked={$hybridSettings.potTrace} /> PO Token trace diagnostics</label>
    {#if $hybridSettings.provider === "manual"}
        <label>Manual tokens <textarea rows="3" bind:value={$hybridSettings.manualPoTokens}></textarea></label>
    {/if}
    {#if capabilities}
        <pre>{JSON.stringify(capabilities, null, 2)}</pre>
    {/if}
</section>

<section>
    <h2>YouTube cookie profiles</h2>
    <p>Import Netscape-format cookies for account-restricted media. Google credentials are never stored.</p>
    <label>Active profile
        <select bind:value={$hybridSettings.cookieProfile}>
            <option value="">None</option>
            {#each profiles as profile}<option value={profile}>{profile}</option>{/each}
        </select>
    </label>
    <label>Profile name <input bind:value={profileName} pattern="[A-Za-z0-9][A-Za-z0-9._-]*" maxlength="64" /></label>
    <input type="file" accept=".txt,text/plain" onchange={(event) => cookieFile = (event.currentTarget as HTMLInputElement).files?.[0]} />
    <button onclick={uploadCookies}>Upload protected cookie profile</button>
    {#each profiles as profile}
        <button class="danger" onclick={() => removeCookies(profile)}>Delete {profile}</button>
    {/each}
    {#if message}<p>{message}</p>{/if}
</section>

<style>
    section { display: flex; flex-direction: column; gap: 10px; padding: 14px; }
    label { display: flex; flex-direction: column; gap: 5px; color: var(--secondary); }
    label.inline { flex-direction: row; }
    textarea, input, select, button, pre { border: 0; border-radius: var(--border-radius); padding: 10px; color: var(--secondary); background: var(--button); box-shadow: var(--button-box-shadow); }
    textarea, pre { font-family: "IBM Plex Mono", monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
    button { cursor: pointer; }
    button.danger { color: var(--red); }
</style>
