import { useRealtime } from './useRealtime'
export function useMessageEvents(uid, scope, handlers) {
  return useRealtime(uid ? `messages:${scope}:${uid}` : null, [
    ['messages', 'INSERT', `receiver_id=eq.${uid}`, 'onIncoming'],
    ['messages', 'INSERT', `sender_id=eq.${uid}`, 'onSent'],
    ['messages', 'UPDATE', `sender_id=eq.${uid}`, 'onRead'],
    ['messages', 'UPDATE', `receiver_id=eq.${uid}`, 'onMarked'],
  ], handlers)
}
