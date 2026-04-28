export type WaitingRoomRequest = {
  requestId: string;
  displayName: string;
};

export type ModerationState = {
  waitingRoom: WaitingRoomRequest[];
};

export const initialModerationState: ModerationState = {
  waitingRoom: [],
};

export function addWaitingRequest(state: ModerationState, req: WaitingRoomRequest): ModerationState {
  return {
    waitingRoom: [...state.waitingRoom.filter((x) => x.requestId !== req.requestId), req],
  };
}

export function removeWaitingRequest(state: ModerationState, requestId: string): ModerationState {
  return {
    waitingRoom: state.waitingRoom.filter((x) => x.requestId !== requestId),
  };
}
