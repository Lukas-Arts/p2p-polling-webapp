import * as Y from 'yjs';
import { stringToCryptoKey, verifyChainedVote } from '~~/server/utils/crypto';
import { PollData, SignedData } from '~~/server/utils/types';
// server/api/polls/[id].ts
export default defineEventHandler(async (event) => {
    const method = event.node.req.method;
    const pollId = getRouterParam(event, 'id');

    // We use Nitro's built-in storage. 
    // 'polls' is the storage namespace.
    const storage = useStorage('polls'); 

    if (!pollId) {
        throw createError({ statusCode: 400, statusMessage: 'Poll ID required' });
    }

    // GET: Fetch the saved Yjs document state
    if (method === 'GET') {
        const data = await storage.getItem(`poll:${pollId}`);
        // Return the array of numbers (or null if it doesn't exist yet)
        return { update: data || null };
    }

    // POST: Save a new Yjs document state
    if (method === 'POST') {
        const body = await readBody(event);

        if (body.update && Array.isArray(body.update)) {
            // create a temp Y.Doc to encode the Data
            var tempDoc = new Y.Doc();
            Y.applyUpdate(tempDoc, new Uint8Array(body.update));
            var yMap = tempDoc.getMap('shared-poll');
            var mapData = yMap.toJSON();
            const pollDataUpdate : SignedData<PollData> = mapData[pollId]

            tempDoc.destroy();
            // get the old data and encode it to compare and verify the update
            const oldPollDataRaw = await storage.getItem(`poll:${pollId}`);
            tempDoc = new Y.Doc();
            Y.applyUpdate(tempDoc, new Uint8Array(body.update));
            yMap = tempDoc.getMap('shared-poll');
            mapData = yMap.toJSON();
            const oldPollData : SignedData<PollData> = mapData[pollId]

            var hasOnlyAppendChanges = verifyPollDataChanges(oldPollData,pollDataUpdate)
            if(!hasOnlyAppendChanges){
                console.error("Failed to verify pollData: "+pollId)
                throw createError({ statusCode: 400, statusMessage: 'PollData contains unverifyable content!' });
            }

            // verify pollData
            for(var option in pollDataUpdate.data.voteData) {
                const votes = pollDataUpdate.data.voteData[option] || [];

                if(!!oldPollData){
                    const oldVotes = oldPollData.data.voteData[option];
                    if(!!oldVotes){
                        if(votes.length<oldVotes.length){
                            console.error("Failed to verify PollData! New Vote Data for option '"+option+"' is smaller than the old one!")
                            return;
                        }
                    }
                }


                var pubKeys: CryptoKey[] = [];

                const verifyAllVotesForOption = async (pollData: SignedData<PollData>,optionName: string) => {
                    console.log("verifying votes for option " + optionName);
                    const voteData = pollData.data.voteData[optionName];
                    if (!!voteData) {
                        // check last votes first. if there is something wrong, its likely in the last vote.
                        for (let i = voteData.length-1; i >= 0 ; i--) {
                            const userStorage = useStorage('users'); 
                            const votePubKeyString = await userStorage.getItem(`user:${voteData[i]?.data.userid}`);
                            //console.log("Using public key: "+votePubKeyString)
                            const votePubKey = await stringToCryptoKey(String(votePubKeyString),'public')
                            const isValid = await verifyChainedVote(pollData,optionName,voteData, i,votePubKey);
                            if(!isValid){
                                console.error("Error! Invalid Vote at: " + i,voteData)
                                return false;
                            }
                        }
                    }
                    return true;
                };
                const verified = await verifyAllVotesForOption(pollDataUpdate,option);
                if(!verified){
                    console.error("Failed to verify option: "+option)
                    throw createError({ statusCode: 400, statusMessage: 'PollData contains unverifyable content!' });
                }
            }

            // Save the binary update (sent as an array of numbers) to storage
            await storage.setItem(`poll:${pollId}`, body.update);
            return { success: true };
        }

        throw createError({ statusCode: 400, statusMessage: 'Invalid update payload' });
    }
});

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