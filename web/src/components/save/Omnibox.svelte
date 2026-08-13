<script lang="ts">
    import env, { officialApiURL } from "$lib/env";

    import { tick } from "svelte";
    import { page } from "$app/state";
    import { goto } from "$app/navigation";
    import { browser } from "$app/environment";

    import { t } from "$lib/i18n/translations";

    import dialogs from "$lib/state/dialogs";
    import { link } from "$lib/state/omnibox";
    import { hapticSwitch } from "$lib/haptics";
    import { updateSetting } from "$lib/state/settings";
    import { savingHandler } from "$lib/api/saving-handler";
    import { pasteLinkFromClipboard } from "$lib/clipboard";
    import { turnstileEnabled, turnstileSolved } from "$lib/state/turnstile";
    import { commandSuggestions, editableCommand, hybridSettings, lastBackendCommands, tiktokIdentity } from "$lib/hybrid/settings";
    import { refreshCommandPreview, useYtDlp } from "$lib/hybrid/api";

    import type { Optional } from "$lib/types/generic";
    import type { DownloadModeOption } from "$lib/types/settings";

    import ClearButton from "$components/save/buttons/ClearButton.svelte";
    import DownloadButton from "$components/save/buttons/DownloadButton.svelte";

    import Switcher from "$components/buttons/Switcher.svelte";
    import OmniboxIcon from "$components/save/OmniboxIcon.svelte";
    import ActionButton from "$components/buttons/ActionButton.svelte";
    import CaptchaTooltip from "$components/save/CaptchaTooltip.svelte";
    import SettingsButton from "$components/buttons/SettingsButton.svelte";

    import IconMute from "$components/icons/Mute.svelte";
    import IconMusic from "$components/icons/Music.svelte";
    import IconSparkles from "$components/icons/Sparkles.svelte";
    import IconClipboard from "$components/icons/Clipboard.svelte";
    import CopyIcon from "$components/misc/CopyIcon.svelte";

    let linkInput: Optional<HTMLInputElement>;

    const validLink = (url: string) => {
        try {
            return /^https?\:/i.test(new URL(url).protocol);
        } catch {}
    };

    let isFocused = $state(false);
    let isDisabled = $state(false);
    let isLoading = $state(false);

    let isHovered = $state(false);
    let copiedAttempt = $state<number | null>(null);
    let copyFailed = $state<number | null>(null);
    let commandEdited = $state(false);
    let previewTimer: ReturnType<typeof setTimeout> | undefined;

    const copyBackendCommand = async (command: string, index: number) => {
        try {
            await navigator.clipboard.writeText(command);
            copiedAttempt = index;
            copyFailed = null;
        } catch {
            copyFailed = index;
        }
        setTimeout(() => copiedAttempt = null, 2000);
    };

    let isBotCheckOngoing = $derived($turnstileEnabled && !$turnstileSolved);

    let linkPrefill = $derived(
        page.url.hash.replace("#", "")
        || (browser ? page.url.searchParams.get("u") : "")
        || ""
    );

    let downloadable = $derived(validLink($link));
    let clearVisible = $derived($link && !isLoading);

    $effect(() => {
        const fingerprint = JSON.stringify([$link, $hybridSettings, $tiktokIdentity]);
        void fingerprint;
        if (previewTimer) clearTimeout(previewTimer);
        if (!validLink($link) || !useYtDlp($link)) return;
        previewTimer = setTimeout(async () => {
            if (!commandEdited) await refreshCommandPreview($link);
        }, 150);
    });

    $effect (() => {
        if (linkPrefill) {
            // prefilled link may be uri encoded
            linkPrefill = decodeURIComponent(linkPrefill);

            if (validLink(linkPrefill)) {
                $link = linkPrefill;
            }

            // clear hash and query to prevent bookmarking unwanted links
            if (browser) goto("/", { replaceState: true });

            // clear link prefill to avoid extra effects
            linkPrefill = "";

            if (!useYtDlp($link)) savingHandler({ url: $link });
        }
    });

    const pasteClipboard = async () => {
        if ($dialogs.length > 0 || isDisabled || isLoading) {
            return;
        }

        hapticSwitch();

        const pastedData = await pasteLinkFromClipboard();
        if (!pastedData) return;

        const linkMatch = pastedData.match(/https?\:\/\/[^\s]+/g);

        if (linkMatch) {
            $link = linkMatch[0].split('，')[0];
            commandEdited = false;
            await tick();
        }
    };

    const changeDownloadMode = (mode: DownloadModeOption) => {
        updateSetting({ save: { downloadMode: mode } });
    };

    const handleKeydown = (e: KeyboardEvent) => {
        if (!linkInput || $dialogs.length > 0 || isDisabled || isLoading) {
            return;
        }

        if (e.metaKey || e.ctrlKey || e.altKey) {
            return;
        }

        if (e.key === "/") {
            e.preventDefault();
            linkInput.focus();
        }

        if (e.key === "Enter" && validLink($link) && isFocused && !useYtDlp($link)) {
            savingHandler({ url: $link });
        }

        if (["Escape", "Clear"].includes(e.key) && isFocused) {
            $link = "";
        }

        if (e.target === linkInput) {
            return;
        }

        switch (e.key) {
            case "D":
                pasteClipboard();
                break;
            case "J":
                changeDownloadMode("auto");
                break;
            case "K":
                changeDownloadMode("audio");
                break;
            case "L":
                changeDownloadMode("mute");
                break;
            default:
                break;
        }
    };

    const handlePaste = (event: ClipboardEvent) => {
        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.closest('[contenteditable="true"]'))) {
            return;
        }
        const pasted = event.clipboardData?.getData("text")?.trim() || "";
        if (!pasted) return;
        event.preventDefault();
        $link = pasted;
        commandEdited = false;
    };
</script>

<svelte:window onkeydown={handleKeydown} onpaste={handlePaste} />

<!--
    if you want to remove the community instance label,
    refer to the license first https://github.com/imputnet/cobalt/tree/main/web#license
-->
{#if env.DEFAULT_API !== officialApiURL}
    <div id="instance-label">
        {$t("save.label.community_instance")}
    </div>
{/if}

<div id="omnibox">
    {#if $turnstileEnabled}
        <CaptchaTooltip
            visible={isBotCheckOngoing && (isHovered || isFocused)}
        />
    {/if}

    <div
        id="input-container"
        class:focused={isFocused}
        class:downloadable
        class:clear-visible={clearVisible}
    >
        <OmniboxIcon loading={isLoading || isBotCheckOngoing} />

        <input
            id="link-area"
            bind:value={$link}
            bind:this={linkInput}
            oninput={() => { isFocused = true; commandEdited = false; }}
            onfocus={() => (isFocused = true)}
            onblur={() => (isFocused = false)}
            onmouseover={() => (isHovered = true)}
            onmouseleave={() => (isHovered = false)}
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            maxlength="512"
            placeholder={$t("save.input.placeholder")}
            aria-label={isBotCheckOngoing
                ? $t("a11y.save.link_area.turnstile")
                : $t("a11y.save.link_area")}
            data-form-type="other"
            disabled={isDisabled}
        />

        <ClearButton click={() => ($link = "")} />
        <DownloadButton
            url={$link}
            bind:disabled={isDisabled}
            bind:loading={isLoading}
        />
    </div>

    <div id="action-container">
        <select
            class="processor-select"
            value={$hybridSettings.processor}
            onchange={(event) => hybridSettings.update((value) => ({
                ...value,
                processor: (event.currentTarget as HTMLSelectElement).value as "automatic" | "cobalt" | "yt-dlp",
            }))}
            aria-label="Download processor"
        >
            <option value="automatic">automatic</option>
            <option value="cobalt">cobalt</option>
            <option value="yt-dlp">yt-dlp</option>
        </select>
        <Switcher>
            <SettingsButton
                settingContext="save"
                settingId="downloadMode"
                settingValue="auto"
            >
                <IconSparkles />
                {$t("save.auto")}
            </SettingsButton>
            <SettingsButton
                settingContext="save"
                settingId="downloadMode"
                settingValue="audio"
            >
                <IconMusic />
                {$t("save.audio")}
            </SettingsButton>
            <SettingsButton
                settingContext="save"
                settingId="downloadMode"
                settingValue="mute"
            >
                <IconMute />
                {$t("save.mute")}
            </SettingsButton>
        </Switcher>

        <ActionButton id="paste" click={pasteClipboard}>
            <IconClipboard />
            <span id="paste-desktop-text">{$t("save.paste")}</span>
            <span id="paste-mobile-text">{$t("save.paste.long")}</span>
        </ActionButton>
    </div>
    {#if useYtDlp($link)}
        <label class="editable-command">
            <span>yt-dlp command — edit before downloading</span>
            <textarea value={$editableCommand} oninput={(event) => { commandEdited = true; editableCommand.set((event.currentTarget as HTMLTextAreaElement).value); }} rows="5" spellcheck="false"></textarea>
        </label>
    {/if}
    {#if $lastBackendCommands.length}
        <div class="backend-command">
            {#each $lastBackendCommands as attempt, index}
                <section class="backend-attempt">
                    <div class="backend-command-heading">
                        <strong>yt-dlp attempt {index + 1}: {attempt.state}</strong>
                        <button type="button" class="copy-command" onclick={() => copyBackendCommand(attempt.command, index)}>
                            <CopyIcon check={copiedAttempt === index} regularIcon={true} />
                            <span>{copiedAttempt === index ? $t("button.copied") : $t("button.copy")}</span>
                        </button>
                    </div>
                    <code>{attempt.command}</code>
                    {#if attempt.output}<pre>{attempt.output}</pre>{/if}
                    {#if copyFailed === index}<span class="copy-status" role="status">copy failed; select the command text manually</span>{/if}
                </section>
            {/each}
        </div>
    {/if}
    {#if $lastBackendCommands.some((attempt) => attempt.state === "failed") && $commandSuggestions.length}
        <div class="command-suggestions">
            <strong>Try one of these known command patterns</strong>
            {#each $commandSuggestions as suggestion, index}
                <section>
                    <div class="backend-command-heading">
                        <span>{suggestion.label}</span>
                        <button type="button" class="copy-command" onclick={() => copyBackendCommand(suggestion.command, 1000 + index)}>
                            <CopyIcon check={copiedAttempt === 1000 + index} regularIcon={true} />
                            <span>{copiedAttempt === 1000 + index ? $t("button.copied") : $t("button.copy")}</span>
                        </button>
                        <button type="button" class="copy-command" onclick={() => { editableCommand.set(suggestion.command); commandEdited = true; }}>
                            use command
                        </button>
                    </div>
                    <code>{suggestion.command}</code>
                </section>
            {/each}
        </div>
    {/if}
</div>

<style>
    #omnibox {
        display: flex;
        flex-direction: column;
        max-width: 640px;
        width: 100%;
        gap: 6px;
        position: relative;
    }

    .processor-select {
        border: 0;
        border-radius: var(--border-radius);
        padding: 8px 12px;
        color: var(--secondary);
        background: var(--button);
        box-shadow: var(--button-box-shadow);
    }

    .backend-command {
        display: flex;
        flex-direction: column;
        gap: 4px;
        color: var(--gray);
        font-size: 11px;
        overflow-wrap: anywhere;
    }
    .backend-attempt { display: flex; flex-direction: column; gap: 6px; }
    .backend-attempt + .backend-attempt { border-top: 1px solid var(--button); padding-top: 10px; }
    .backend-attempt pre { max-height: 16rem; overflow: auto; white-space: pre-wrap; user-select: text; }
    .editable-command { display: flex; flex-direction: column; gap: 5px; color: var(--secondary); }
    .editable-command textarea { border: 0; border-radius: var(--border-radius); padding: 10px; color: var(--secondary); background: var(--button); font-family: "IBM Plex Mono", monospace; }
    .command-suggestions { display: flex; flex-direction: column; gap: 10px; color: var(--gray); font-size: 11px; }
    .command-suggestions section { display: flex; flex-direction: column; gap: 5px; }
    .command-suggestions code { color: var(--secondary); white-space: pre-wrap; user-select: text; -webkit-user-select: text; }

    .backend-command code {
        color: var(--secondary);
        white-space: pre-wrap;
        cursor: text;
        user-select: text;
        -webkit-user-select: text;
    }

    .backend-command-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }

    .copy-command {
        display: flex;
        align-items: center;
        gap: 5px;
        border: 0;
        border-radius: var(--border-radius);
        padding: 4px 8px;
        color: var(--secondary);
        background: var(--button);
        cursor: pointer;
    }

    .copy-command:focus-visible {
        outline: 2px solid var(--secondary);
        outline-offset: 2px;
    }

    .copy-command :global(.copy-animation) {
        width: 14px;
        height: 14px;
    }

    .copy-status {
        color: var(--error);
    }

    #input-container {
        --input-padding: 10px;
        display: flex;
        box-shadow: 0 0 0 1.5px var(--input-border) inset;
        /* webkit can't render the 1.5px box shadow properly,
           so we duplicate the border as outline to fix it visually */
        outline: 1.5px solid var(--input-border);
        outline-offset: -1.5px;
        border-radius: var(--border-radius);
        align-items: center;
        gap: var(--input-padding);
        font-size: 14px;
        flex: 1;
    }

    #input-container:not(.clear-visible) :global(#clear-button) {
        display: none;
    }

    #input-container:not(.downloadable) :global(#download-button) {
        display: none;
    }

    #input-container.clear-visible {
        padding-right: var(--input-padding);
    }

    :global([dir="rtl"]) #input-container.clear-visible {
        padding-right: unset;
        padding-left: var(--input-padding);
    }

    #input-container.downloadable {
        padding-right: 0;
    }

    #input-container.downloadable:dir(rtl) {
        padding-left: 0;
    }

    #input-container.focused {
        box-shadow: none;
        outline: var(--secondary) 2px solid;
        outline-offset: -1px;
    }

    #input-container.focused :global(#input-icons svg) {
        stroke: var(--secondary);
    }

    #input-container.downloadable :global(#input-icons svg) {
        stroke: var(--secondary);
    }

    #link-area {
        display: flex;
        width: 100%;
        margin: 0;
        padding: var(--input-padding) 0;
        padding-left: calc(var(--input-padding) + 28px);
        height: 18px;

        align-items: center;

        border: none;
        outline: none;
        background-color: transparent;
        color: var(--secondary);

        -webkit-tap-highlight-color: transparent;
        flex: 1;

        font-weight: 500;

        /* workaround for safari */
        font-size: inherit;

        /* prevents input from poking outside of rounded corners */
        border-radius: var(--border-radius);
    }

    :global([dir="rtl"]) #link-area {
        padding-left: unset;
        padding-right: calc(var(--input-padding) + 28px);
    }

    #link-area::placeholder {
        color: var(--gray);
        /* fix for firefox */
        opacity: 1;
    }

    /* fix for safari */
    input:disabled {
        opacity: 1;
    }

    #action-container {
        display: flex;
        flex-direction: row;
    }

    #action-container {
        justify-content: space-between;
    }

    #paste-mobile-text {
        display: none;
    }

    #instance-label {
        font-size: 13px;
        color: var(--gray);
        font-weight: 500;
    }

    @media screen and (max-width: 440px) {
        #action-container {
            flex-direction: column;
            gap: 5px;
        }

        #action-container :global(.button) {
            width: 100%;
        }

        #paste-mobile-text {
            display: block;
        }

        #paste-desktop-text {
            display: none;
        }
    }
</style>
