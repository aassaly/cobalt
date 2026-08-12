<script lang="ts">
    import type { MeowbaltEmotions } from "$lib/types/meowbalt";

    type Props = {
        emotion: MeowbaltEmotions;
        forceLoaded?: boolean;
    };

    const { emotion, forceLoaded }: Props = $props();

</script>

<div
    class="meowbalt {emotion}"
    aria-hidden="true"
>↓</div>

<style>
    .meowbalt {
        display: grid;
        place-items: center;
        width: 110px;
        height: 110px;
        border-radius: 50%;
        background: var(--button);
        color: var(--secondary);
        font-size: 42px;
        margin: 0;
    }

    .error {
        height: 110px;
    }

    .question {
        height: 110px;
    }

    .error {
        margin-left: 25px;
    }
</style>
