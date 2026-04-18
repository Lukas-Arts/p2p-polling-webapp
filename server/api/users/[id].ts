// server/api/users/[id].ts
export default defineEventHandler(async (event) => {
    const method = event.node.req.method;
    const userId = getRouterParam(event, 'id');

    // We use Nitro's built-in storage. 
    // 'polls' is the storage namespace.
    const storage = useStorage('users'); 

    if (!userId) {
        throw createError({ statusCode: 400, statusMessage: 'User ID required' });
    }

    // GET: Fetch the saved Yjs document state
    if (method === 'GET') {
        const data = await storage.getItem(`user:${userId}`);
        // Return the array of numbers (or null if it doesn't exist yet)
        return { public_key: data };
    }

    // POST: Save a new Yjs document state
    if (method === 'POST') {
        const body = await readBody(event);

        if (body.public_key) {
            const data = await storage.getItem(`user:${userId}`);

            if (data == undefined || data == null) {
                // Save the binary update (sent as an array of numbers) to storage
                await storage.setItem(`user:${userId}`, body.public_key);
                console.log("New User created: " + userId)
                console.log("Public Key: " + body.public_key);
                return { success: true };
            }

            throw createError({ statusCode: 400, statusMessage: 'User already exists.' });
        }

        throw createError({ statusCode: 400, statusMessage: 'Invalid update payload' });
    }
});