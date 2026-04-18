// composables/usePoll.ts
import { ref, watch, onUnmounted } from 'vue';
import * as Y from 'yjs';

export const usePoll = (pollId: Ref<string | null>, user: Ref<UserData | null>) => {
    const pollData = ref<SignedData<PollData>>();
    const isConnected = ref(false);
    const connectionAttempFailed = ref(false);
    const connectedPeers = ref(1);
    const updateProbFactor = 1.5

    let ydoc: Y.Doc | null = null;
    let provider: any = null;
    let yMap: Y.Map<SignedData<PollData>> | null = null;

    const cleanup = () => {
    if (provider) provider.disconnect();
        if (ydoc) ydoc.destroy();
        isConnected.value = false;
        pollData.value = undefined;
    };
    const createPoll = async (id: string) => {
        cleanup(); // Clear previous session


        // 1. Check if Poll exists on server
        try {
            const response = await $fetch<{ update: number[] | null }>(`/api/polls/${id}`)
            if (response?.update !== null) {
                console.error("Poll already exists2!",response?.update)
                return;
            }
            // create new Poll
            ydoc = new Y.Doc();
            yMap = ydoc.getMap<SignedData<PollData>>('shared-poll');



            // 2. Local State Sync
            yMap.observe(async () => {
                const pollDataUpdate = yMap!.toJSON();
                // save to server based on a probability based on the number of connected peers
                var rand = Math.random();
                if(rand <= (1/connectedPeers.value) * updateProbFactor) {
                    saveStateToServer(id);
                }
            });
            const pollDataUpdate = yMap!.toJSON();

            // 3. P2P Connection
            const { WebrtcProvider } = await import('y-webrtc');
            provider = new WebrtcProvider(`nuxt-p2p-${id}`, ydoc, {
                signaling: ["ws://localhost:4444", "ws://lynxpi.ddns.net:4444"]
            });
            provider.on('synced', (arg: {synced: boolean}) => {
                isConnected.value = arg.synced;
                console.log('Connection synced:', arg.synced) // "connected" or "disconnected"
            });
            provider.on('status', (event: { connected: boolean }) => {
                console.log('Connection status:', event.connected) // "connected" or "disconnected"
            })
            provider.on('peers', (data: any) => {
                connectedPeers.value = data.webrtcPeers.length + 1
            });
            
            console.log(pollDataUpdate)
            if(Object.keys(pollDataUpdate).length === 0) {
                const pollUser = user.value;
                if(pollUser && pollUser.private_key){
                    const unsignedPollData : PollData = {
                        pollName: id,
                        userid: pollUser.userid,
                        timestamp: new Date().toISOString(),
                        start_timestamp: undefined,
                        end_timestamp: undefined,
                        optionData: [],
                        voteData: {}
                    }

                    var signedPollData : SignedData<PollData> = {
                        data: unsignedPollData,
                        signature: await signData(unsignedPollData,pollUser.private_key)
                    }
                    yMap?.set(id, signedPollData);
                }
            }else{
                console.error("Poll already exists1!")
            }
        } catch (err) {
            console.error('Persistence fetch failed', err);
        }
    }
    const initPoll = async (id: string) => {
        cleanup(); // Clear previous session

        ydoc = new Y.Doc();

        // 1. Fetch Snapshot from Nuxt API
        try {
            const response = await $fetch<{ update: number[] | null }>(`/api/polls/${id}`).catch((e) => {
                console.error("Failed to get poll: " + id,e)
            });
            //trust the server without verification.
            if (response?.update) {
                Y.applyUpdate(ydoc, new Uint8Array(response.update));
            }
        } catch (err) {
            console.error('Persistence fetch failed', err);
        }

        yMap = ydoc.getMap<SignedData<PollData>>('shared-poll');

        // 2. Local State Sync
        yMap.observe(async () => {
            await performUpdateAndVerify(true);
        });
        await performUpdateAndVerify(false);

        // 3. P2P Connection
        const { WebrtcProvider } = await import('y-webrtc');
        provider = new WebrtcProvider(`nuxt-p2p-${id}`, ydoc, {
            signaling: ["ws://localhost:4444", "ws://lynxpi.ddns.net:4444"]
        });

        provider.on('synced', (arg: {synced: boolean}) => {
            isConnected.value = arg.synced;
            console.log('Connection synced:', arg.synced) // "connected" or "disconnected"
        });
        provider.on('status', (event: { connected: boolean }) => {
            console.log('Connection status:', event.connected) // "connected" or "disconnected"
        })
        provider.on('peers', (data: any) => {
            connectedPeers.value = data.webrtcPeers.length + 1
        });
    };

    const saveStateToServer = async (id: string) => {
        if (!ydoc) return;
        const stateUpdate = Y.encodeStateAsUpdate(ydoc);
        await $fetch(`/api/polls/${id}`, {
            method: 'POST',
            body: { update: Array.from(stateUpdate) }
        }).catch((e) => {
            console.error("Failed to update poll",e)
        });
    };

    // Watch for ID changes (e.g., user clicks a link or goes back)
    watch(pollId, (newId) => {
        if (newId && import.meta.client) {
            initPoll(newId);
        } else {
            cleanup();
        }
    }, { immediate: true });

    onUnmounted(cleanup);

    const addOption = async (optionName: string) => {
        if (yMap && pollData.value && user.value && user.value.private_key) {
            const signedOptionDataArray = pollData.value.data.optionData;
            const pollid = pollData.value.data.pollName;
            for(let signedOptionData of signedOptionDataArray) {
                if(optionName === signedOptionData.data.optionName) {
                    console.error("Failed to create new option '"+ optionName + "' for Poll '"+pollid+"'")
                    return;
                }
            }

            var unsignedOptionData : OptionData = {
                optionName: optionName,
                userid: user.value.userid,
                timestamp: new Date().toISOString()
            }
            var newOption : SignedData<OptionData> = {
                data: unsignedOptionData,
                signature: "",
            }
            // sign base data the poll with this option added, but without any votedata or other options
            const unsignedPollData : PollData = {
                pollName: pollid,
                userid: pollData.value.data.userid,
                timestamp: pollData.value.data.timestamp,
                start_timestamp: pollData.value.data.start_timestamp,
                end_timestamp: pollData.value.data.end_timestamp,
                optionData: [newOption],
                voteData: {}
            }
            var signedPollBaseData : SignedData<PollData> = {
                data: unsignedPollData,
                signature: pollData.value.signature,
            }
            const signature = await signData(signedPollBaseData,user.value.private_key)
            newOption.signature = signature
            pollData.value.data.optionData.push(newOption)
            yMap.set(pollid, pollData.value);
        }
    };

    const performUpdateAndVerify = async (saveState: boolean) => {
        const mapUpdate = yMap!.toJSON();

        if(Object.keys(mapUpdate).length === 1 && pollId.value) {
            const pollDataUpdate : SignedData<PollData> = mapUpdate[pollId.value];
            
            //console.log("Verifying new Poll Data Update: ", pollDataUpdate)
            const oldData = pollData.value;
            if(!!oldData){
                if(pollDataUpdate.data.optionData.length<oldData.data.optionData.length){
                    console.error("Failed to verify PollData! New Poll Data is smaller than the old one!")
                    return;
                }
                const hasOnlyAppendChanges = verifyPollDataChanges(oldData,pollDataUpdate)
                if (!hasOnlyAppendChanges) {
                    return;
                }
            }

            for(var option in pollDataUpdate.data.voteData){
                //console.log("verifying votes for option: " + option);

                const votes = pollDataUpdate.data.voteData[option] || [];
                if(!!oldData){
                    const oldVotes = oldData.data.voteData[option];
                    if(!!oldVotes){
                        if(votes.length<oldVotes.length){
                            console.error("Failed to verify PollData! New Vote Data for option '"+option+"' is smaller than the old one!")
                            return;
                        }
                    }
                }
                const verified = await verifyAllVotesForOption(pollDataUpdate,option);
                if(!verified){
                    console.error("Failed to verify option: "+option)
                    return;
                }
            }
            console.log("All options verified! :)")
            pollData.value = pollDataUpdate
            if(saveState){
                saveStateToServer(pollId.value)
            }
        }
    }
    const verifyPollDataChanges = (
        oldSigned: SignedData<PollData>, 
        newSigned: SignedData<PollData>
    ): boolean => {
        const oldPoll = oldSigned.data;
        const newPoll = newSigned.data;

        // 1. Verify Immutable Metadata
        if (oldSigned.signature !== newSigned.signature) {
            return false;
        }

        // 2. Verify optionData (Append-only Array)
        if (newPoll.optionData.length < oldPoll.optionData.length) return false;
        
        for (let i = 0; i < oldPoll.optionData.length; i++) {
            // Compare signatures to ensure existing options weren't modified
            const newOptionData = newPoll.optionData[i]
            const oldOptionData = oldPoll.optionData[i]
            if (!newOptionData || !oldOptionData || newOptionData.signature !== oldOptionData.signature) {
                return false;
            }
        }

        // 3. Verify voteData (Record/Map structure)
        const oldOptionKeys = Object.keys(oldPoll.voteData);

        for (const optionId of oldOptionKeys) {
            const oldVotes = oldPoll.voteData[optionId];
            const newVotes = newPoll.voteData[optionId];

            // Ensure previously existing options (keys) were not deleted
            if (!newVotes) return false;
            if (!oldVotes) return false;

            // Ensure vote arrays for existing options haven't shrunk
            if (newVotes.length < oldVotes.length) return false;

            // Verify that existing votes have not been tampered with
            for (let i = 0; i < oldVotes.length; i++) {
                const oldVote = oldVotes[i];
                const newVote = newVotes[i];
                
                if (!newVote || !oldVote || newVote.signature !== oldVote.signature) {
                    return false;
                }
            }
        }

        // Logic allows for new keys in voteData or more items in optionData
        return true;
    };

    const vote = async (optionName: string) => {
        const currentUser = user.value;
        console.log("Voting "+optionName);
        if (currentUser != undefined && pollData.value) {
            const optionData = getOptionByName(pollData.value.data.optionData,optionName)
            if(optionData !== null) {
                const voteData = [...(pollData.value.data.voteData[optionName] || [])];
                if(currentUser.private_key){
                    var unsignedVoteData : VoteData = {
                        userid: currentUser.userid,
                        timestamp: new Date().toISOString()
                    }
                    var newVote : SignedData<VoteData> = {
                        data: unsignedVoteData,
                        signature: "",
                    }
                    voteData?.push(newVote)

                    // sign base data the poll with this option added, but without any votedata or other options
                    const unsignedPollData : PollData = {
                        pollName: pollData.value.data.pollName,
                        userid: pollData.value.data.userid,
                        timestamp: pollData.value.data.timestamp,
                        start_timestamp: pollData.value.data.start_timestamp,
                        end_timestamp: pollData.value.data.end_timestamp,
                        optionData: [optionData],
                        voteData: {[optionName]:voteData}
                    }
                    var signedPollBaseData : SignedData<PollData> = {
                        data: unsignedPollData,
                        signature: pollData.value.signature,
                    }

                    const signature = await signData(signedPollBaseData,currentUser.private_key);
                    newVote.signature=signature
                    pollData.value.data.voteData[optionName]=voteData
                    yMap?.set(pollData.value.data.pollName, pollData.value);
                }else {
                    console.error("Unable to vote2!");
                }
            } else {
                console.error("Failed to Vote! OptionData for option '"+optionName+"' not found!")
            }
        }else {
            console.error("Failed to Vote! currentUser or pollData not found!");
        }
    };

    const getOptionByName = (optionDataArray: SignedData<OptionData>[], optionName: string) => {

        for(let optionData of optionDataArray){
            if(optionName === optionData.data.optionName){
                return optionData;
            }
        }
        return null;
    }

    return { pollData, isConnected, connectionAttempFailed, connectedPeers, createPoll, addOption, vote };
};