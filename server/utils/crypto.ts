import { PollData, SignedData, VoteData } from "./types";
/**
 * Gets the WebCrypto API regardless of environment (Node vs Browser)
 */
const getCrypto = () => {
  return (globalThis as any).crypto;
};

export const verifyVote = async (data: any, signatureStr: string, publicKey: CryptoKey) => {
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(JSON.stringify(data));
  
  // Convert Base64 back to Uint8Array
  const signature = Uint8Array.from(atob(signatureStr), c => c.charCodeAt(0));

  return await getCrypto().subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    signature,
    encodedData
  );
};

/**
 * Verifies a specific vote within an array of votes by 
 * reconstructing the "signed state" at that point in time.
 */
export const verifyChainedVote = async (
    pollData: SignedData<PollData>,
    optionName: string, 
    voteData: SignedData<VoteData>[],
    index: number,
    pubKey: CryptoKey
) => {
  const voteToVerify = voteData[index];
  console.log("Verifying vote: " + voteToVerify)
  if(voteToVerify) {
    const getOptionByName = () => {
      for(let optionData of pollData.data.optionData){
          if(optionName === optionData.data.optionName){
              return optionData;
          }
      }
    }
    const optionData = getOptionByName()

    if(!!optionData) {
      // 1. Reconstruct the exact data state the user signed
      // We need the array exactly as it was when they pushed their vote
      const historicalVoteState = voteData.slice(0, index + 1).map((v, i) => {
          if (i === index) {
              // For the current vote, the signature must be empty string
              // because it wasn't signed yet when passed to signVote
              return { ...v, signature: "" };
          }
          return v;
      });

      // sign base data of the poll with this option and its votes added, but without any other votedata or optionsData from the other options
      const unsignedPollData : PollData = {
          pollName: pollData.data.pollName,
          userid: pollData.data.userid,
          timestamp: pollData.data.timestamp,
          start_timestamp: pollData.data.start_timestamp,
          end_timestamp: pollData.data.end_timestamp,
          optionData: [optionData],
          voteData: {[optionName]:historicalVoteState}
      }
      var signedPollBaseData : SignedData<PollData> = {
          data: unsignedPollData,
          signature: pollData.signature,
      }

      try {
          console.log("Using pubKey to verify Vote...",signedPollBaseData)
          // 3. Verify: Does this historicalState match the signature?
          return await verifyVote(signedPollBaseData, voteToVerify.signature, pubKey);
      } catch (err) {
          console.error("Verification failed")
          console.error(err);
          return false;
      }
    } else {
      console.error("Failed to verify Vote! No OptionData found!")
    }
  }
  console.error("Vote is undefined or null");
  return false;
};


/**
 * Converts a Base64 string back into a usable CryptoKey object
 * @param keyStr The Base64 string (without PEM headers)
 * @param type 'public' or 'private'
 */
export const stringToCryptoKey = async (keyStr: string, type: 'public' | 'private'): Promise<CryptoKey> => {
  // 1. Convert Base64 string to a Uint8Array (binary)
  const bytes = Buffer.from(keyStr, 'base64');

  // 2. Identify the format based on the key type
  // Public keys usually use 'spki', Private keys use 'pkcs8'
  const format = type === 'public' ? 'spki' : 'pkcs8';
  const usages: KeyUsage[] = type === 'public' ? ['verify'] : ['sign'];

  // 3. Import the key
  return await getCrypto().subtle.importKey(
    format,
    bytes,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    true, // extractable (set to false if you want to lock it in memory)
    usages
  );
};