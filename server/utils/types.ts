export interface PollProps {
    userid: string | undefined,
    activePollId: string,
    pollData: PollData,
    addOption: (name: string) => void,
    vote: (optionName: string) => void
}

export interface PollListProps {
    userid: string | undefined,
}

export interface PollData {
    pollName: string,
    userid: string,
    timestamp: string,
    start_timestamp: string | undefined,
    end_timestamp: string | undefined,
    optionData: SignedData<OptionData>[]
    voteData: Record<string,SignedData<VoteData>[]>
}

export interface SignedData<T> {
    data: T,
    signature: string
}

export interface VoteData {
    userid: string,
    timestamp: string
}

export interface OptionData {
    optionName: string,
    userid: string,
    timestamp: string,
}

export interface UserData {
    userid: string,
    private_key: CryptoKey | undefined,
    public_key: CryptoKey | undefined
}