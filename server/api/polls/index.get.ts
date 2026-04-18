// server/api/polls/index.get.ts
export default defineEventHandler(async () => {
    const storage = useStorage('polls');
    
    // Get all keys in the 'polls' namespace
    const allKeys = await storage.getKeys();
    
    // Filter for our specific poll prefix and strip it for the UI
    // poll:my-id -> my-id
    const polls = allKeys
        .filter(key => key.startsWith('poll:'))
        .map(key => key.replace('poll:', ''));

    return { polls };
});