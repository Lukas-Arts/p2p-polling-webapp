import type { SignedData, PollData, VoteData } from "./types";

// utils/crypto.ts
export const generateUserKeyPair = async () => {
  return await window.crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: "SHA-256",
    },
    true, // extractable
    ["sign", "verify"]
  );
};

export const signData = async (data: any, privateKey: CryptoKey) => {
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(JSON.stringify(data));

  const signature = await window.crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    encodedData
  );

  // Convert to Base64 or Hex to store in Yjs easily
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
};

export const verifyVote = async (data: any, signatureStr: string, publicKey: CryptoKey) => {
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(JSON.stringify(data));
  
  // Convert Base64 back to Uint8Array
  const signature = Uint8Array.from(atob(signatureStr), c => c.charCodeAt(0));

  return await window.crypto.subtle.verify(
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
    index: number
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
          // 2. Fetch public key
          const response = await $fetch<{ public_key: string }>(`/api/users/${voteToVerify.data.userid}`);
          console.log("Got key: ",response)
          const pubKey = await stringToCryptoKey(response.public_key, 'public');

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

export const verifyAllVotesForOption = async (pollData: SignedData<PollData>,optionName: string) => {
    console.log("verifying votes for option ",optionName);
    const voteData = pollData.data.voteData[optionName];
    if (!!voteData) {
        for (let i = voteData.length-1; i >= 0 ; i--) {
            const isValid = await verifyChainedVote(pollData,optionName,voteData, i);
            if(!isValid){
                console.error("Error! Invalid Vote at: " + i,voteData)
                return false;
            }
        }
    }
    return true;
};

// Helper to convert ArrayBuffer to Base64 string
const bufferToBase64 = (buf: ArrayBuffer) => 
  window.btoa(String.fromCharCode(...new Uint8Array(buf)));

export const exportPublicKey = async (key: CryptoKey) => {
  // Export Public Key
  const exportedPublic = await window.crypto.subtle.exportKey("spki", key);
  const publicKeyString = bufferToBase64(exportedPublic);

  return publicKeyString;
};
export const exportPrivateKey = async (key: CryptoKey) => {
  // Export Private Key
  const exportedPrivate = await window.crypto.subtle.exportKey("pkcs8", key);
  const privateKeyString = bufferToBase64(exportedPrivate);

  return privateKeyString;
};

/**
 * Converts a Base64 string back into a usable CryptoKey object
 * @param keyStr The Base64 string (without PEM headers)
 * @param type 'public' or 'private'
 */
export const stringToCryptoKey = async (keyStr: string, type: 'public' | 'private'): Promise<CryptoKey> => {
  // 1. Convert Base64 string to a Uint8Array (binary)
  const binaryString = window.atob(keyStr);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // 2. Identify the format based on the key type
  // Public keys usually use 'spki', Private keys use 'pkcs8'
  const format = type === 'public' ? 'spki' : 'pkcs8';
  const usages: KeyUsage[] = type === 'public' ? ['verify'] : ['sign'];

  // 3. Import the key
  return await window.crypto.subtle.importKey(
    format,
    bytes.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    true, // extractable (set to false if you want to lock it in memory)
    usages
  );
};

export const savePrivateKeyToFile = (privateKeyStr: string, filename: string) => {
  // Optional: Wrap in PEM headers for standard formatting
  const pemHeader = "-----BEGIN PRIVATE KEY-----\n";
  const pemFooter = "\n-----END PRIVATE KEY-----";
  const fileContent = pemHeader + privateKeyStr + pemFooter;

  const blob = new Blob([fileContent], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const loadPrivateKeyFromFile = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;
      
      // Clean up the string by removing PEM headers and newlines
      const cleanKey = content
        .replace("-----BEGIN PRIVATE KEY-----", "")
        .replace("-----END PRIVATE KEY-----", "")
        .replace(/\s+/g, ""); // Removes all whitespace/newlines
        
      resolve(cleanKey);
    };

    reader.onerror = () => reject("Error reading file");
    reader.readAsText(file);
  });
};