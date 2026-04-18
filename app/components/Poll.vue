<style scoped>
.poll-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.poll-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 0.5rem;
}
.poll-title { 
  font-size: 1.1rem; 
  color: #3b82f6; 
  text-transform: uppercase; 
  letter-spacing: 1px;
}

.add-option-form {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
}

.option-name { font-weight: 500; }
.vote-section { display: flex; align-items: center; gap: 1rem; }
.vote-count { font-size: 0.9rem; color: #475569; }
.vote-btn { padding: 0.4rem 0.8rem; background: #10b981; }
.vote-btn:hover { background: #059669; }

.vote-btn:disabled,
.vote-btn[disabled] { background: #888888; }
.vote-btn:disabled:hover,
.vote-btn[disabled]:hover { background: #AAAAAA; }
</style>

<template>
    <div>
        <h2 class="poll-title" :title="'Created by: '+pollData.userid">Poll: {{ activePollId }}</h2>
        <p v-if="Object.keys(pollData).length==0">Note: Add at least one Option to save the Poll.</p>
        <form @submit.prevent="handleAddNewOption" class="add-option-form" v-if="userid">
            <input v-model="newOption" placeholder="Enter a new poll option..." required />
            <button type="submit">Add Option</button>
        </form>

        <ul class="poll-list">
            <li v-for="(optionData, index) in pollData.optionData" :key="index" class="poll-item">
                <span class="option-name" :title="'Created by: '+optionData.data.userid">{{ optionData.data.optionName }}</span>
                <div class="vote-section">
                    <span class="vote-count" :title="'Votes: '+JSON.stringify(pollData.voteData[optionData.data.optionName])">{{ pollData.voteData[optionData.data.optionName] ? pollData.voteData[optionData.data.optionName]?.length : 0 }} {{ pollData.voteData[optionData.data.optionName]?.length === 1 ? 'vote' : 'votes' }}</span>
                    <button @click="vote(optionData.data.optionName)" class="vote-btn" :disabled="userid==undefined || voted(pollData.voteData[optionData.data.optionName])">+1</button>
                </div>
            </li>
        </ul>
    </div>
</template>

<script setup lang="ts">
    import type { PollProps, SignedData, VoteData } from '@/utils/types'
    const props = defineProps<PollProps>()

    const newOption = ref('');
    const handleAddNewOption = () => {
        props.addOption(newOption.value);
        newOption.value = '';
    };


    const voted = (votes: SignedData<VoteData>[] | undefined) => {
        if(!votes) return false;
        for(let vote of votes){
            if(vote.data.userid == props.userid){
                return true;
            }
        }
        return false;
    }
</script>