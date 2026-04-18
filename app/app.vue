<style>
/* Basic styling to make it look clean */
body {
  font-family: system-ui, -apple-system, sans-serif;
  background-color: #f4f4f9;
  color: #333;
  margin: 0;
  display: flex;
  justify-content: center;
  padding: 2rem;
}

header {
  margin-bottom: 2rem;
  text-align: center;
}

h1 { margin: 0 0 0.5rem 0; }

input {
  flex-grow: 1;
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 1rem;
}

button,
.button {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  transition: background 0.2s;
}

button:hover,
.button:hover { background: #2563eb; }

.status {
  font-size: 0.85rem;
  color: #666;
}
.status .connected { color: #10b981; font-weight: bold; }

.connectionFailed { color: #FF2525; font-weight: bold; }

.poll-container {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  width: 100%;
  max-width: 500px;
}

.back-btn { 
  margin-left: 1rem; 
  padding: 0.2rem 0.5rem; 
  font-size: 0.7rem; 
  background: #64748b; 
}

/* Hide the actual file input */
input[type="file"] {
  display: none;
}

</style>
<template>
    <div class="poll-container">
        <header>
            <h1 @click="activePollId = null" style="cursor:pointer">P2P Polling App 🗳️</h1>
            <div class="status">
                <button v-if="activePollId" @click="activePollId = null" class="back-btn">← Back To List</button>
                <span :class="{ 'connected': isConnected }">
                    ● {{ isConnected ? 'Synced' : 'Waiting for other Peers...' }}
                </span>
                <span> | Peers online: {{ connectedPeers }}</span>
                <h2 v-if="connectionAttempFailed" class="connectionFailed">⚠ Connection to Signaling Server Failed!</h2>
                <div v-if="user===null" style="margin-top: 10px;">
                    <button @click="createUser">Create New User</button>
                    Or
                    <label title="Select Key File">
                        <span class="button">Login</span>
                        <input 
                            type="file"
                            accept=".pem"
                            @change="loadUser"
                        />
                    </label>
                </div>
            </div>
        </header>

        <main>
            <PollList v-if="!activePollId" :userid="user?.userid" @create-poll="createPoll2" @select-poll="selectPoll" />
            <Poll v-else-if="pollData" :activePollId="activePollId" :userid="user?.userid" :poll-data="pollData.data" :addOption="addOption" :vote="vote"/>
        </main>
    </div>
</template>

<script setup lang="ts">
    import { v4 as uuidv4 } from 'uuid';
    const activePollId = ref<string | null>(null);
    const user = shallowRef<UserData | null>(null);

    const { pollData, isConnected, connectionAttempFailed, connectedPeers, createPoll, addOption, vote } = usePoll(activePollId,user);

    const createPoll2 = async (id: string) => {
        await createPoll(id)
        
        // this sometimes leads to an connection error with the provider. setTimeout(,0) seemed to help. Not sure what's going on here.
        activePollId.value = id
    };
    const selectPoll = (id: string) => {
        activePollId.value = id;
    };


    const createUser = async () => {
        try {
            const keypair : CryptoKeyPair = await generateUserKeyPair();
            console.log('keypair:', keypair);
            const uuid = uuidv4();
            user.value = {
                userid: uuid,
                private_key: keypair.privateKey,
                public_key: keypair.publicKey,
            };
            const prvKeyString = await exportPrivateKey(keypair.privateKey);
            await savePrivateKeyToFile(prvKeyString,uuid+".pem")

            
            const pubKeyString = await exportPublicKey(keypair.publicKey);
            await $fetch(`/api/users/${uuid}`, {
                method: 'POST',
                body: { public_key: pubKeyString }
            });
        } catch (err) {
            user.value = null
            console.error("Failed to create new User!", err);
        }
    };
    const loadUser = async (event: Event) => {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];

        if (file) {
            try {
                const content = await file.text();
                console.log("File loaded: ");
                if (file.name && content) {
                    try {
                        const uuid = file.name.replace(".pem", "");
                        // Standardize the string for the importer
                        const pkBase64 = content.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----/g, "").replace(/\s+/g, "");

                        const key = await stringToCryptoKey(pkBase64, "private");
                        
                        user.value = {
                            userid: uuid,
                            private_key: key,
                            public_key: undefined, // Note: You might need to import a pub key too!
                        };
                        
                        console.log("Login successful for:", uuid);
                    } catch (err) {
                        console.error("Crypto Import Error:", err);
                        alert("The file content is not a valid Private Key.");
                    }
                }
            } catch (e) {
                console.error("Failed to read file", e);
            }
        }
    };
</script>