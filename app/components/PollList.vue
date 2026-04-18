<style scoped>
    .poll-list { margin-top: 1rem; }
    .empty-state { text-align: center; color: #94a3b8; font-style: italic; }
    .create-poll { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
    .poll-links { list-style: none; padding: 0; }
    .poll-link-btn {
        width: 100%;
        text-align: left;
        background: #f1f5f9;
        color: #1e293b;
        margin-bottom: 0.5rem;
        display: flex;
        justify-content: space-between;
    }
    .poll-link-btn:hover { background: #e2e8f0; }
</style>

<template>
    <div class="poll-list">
        <h3>Available Polls</h3>

        <ul v-if="polls && polls.length > 0" class="poll-links">
            <li v-for="id in polls" :key="id">
                <button class="poll-link-btn" @click="$emit('select-poll', id)">
                    {{ id }} <span>→</span>
                </button>
            </li>
        </ul>
        <p v-else class="empty-state">No polls found. Create the first one!</p>
        <div class="create-poll" v-if="userid !== undefined">
            <input 
                v-model="newPollId" 
                placeholder="Enter new poll name..." 
                @keyup.enter="createPoll"
            />
            <button @click="createPoll">Create & Join</button>
        </div>
    </div>
</template>

<script setup lang="ts">
    import type { PollListProps } from '@/utils/types'
    const props = defineProps<PollListProps>()
    const newPollId = ref('');
    const polls = ref<string[]>([]);

    // Fetch existing polls on mount
    const fetchPolls = async () => {
        const data = await $fetch<{ polls: string[] }>('/api/polls');
        polls.value = data.polls;
    };

    const createPoll = () => {
        const id = newPollId.value.trim().toLowerCase().replace(/\s+/g, '-');
        if (id) {
            // In a real app, you might want to POST to create it first, 
            // but here we just navigate to it and let usePoll handle the save.
            emit('create-poll', id);
        }
    };

    const emit = defineEmits(['create-poll','select-poll']);
    onMounted(fetchPolls);
</script>