"use client";
import { useSyncExternalStore } from "react";
import { subscribeOffline, getOfflineState, getServerOfflineState } from "./engine";

/** Browser events plus the existing API reachability probe drive this single source of truth. */
export function useNetworkStatus() {
  const state = useSyncExternalStore(subscribeOffline, getOfflineState, getServerOfflineState);
  const phase = state.syncing ? "SYNCING" : state.checking && !state.online ? "RECONNECTING"
    : !state.online ? "OFFLINE" : state.failed ? "SYNC_ERROR"
    : state.lastSyncedAt && !state.pending ? "SYNC_COMPLETE" : "ONLINE";
  return { ...state, phase };
}
