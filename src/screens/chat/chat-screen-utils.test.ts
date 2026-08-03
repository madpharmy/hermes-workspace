import { describe, expect, it } from 'vitest'

import {
  advanceStickyStreamingText,
  createResponseWaitSnapshot,
  isTerminalActiveRunStatus,
  shouldCancelStreamOnNavigation,
  shouldClearWaitingForAssistantMessage,
} from './chat-screen-utils'

describe('advanceStickyStreamingText', () => {
  it('preserves the last non-empty streaming text when a tool phase temporarily reports empty text', () => {
    const afterText = advanceStickyStreamingText({
      isStreaming: true,
      runId: 'run-1',
      rawText: 'Working through the task',
      smoothedText: 'Working through the task',
      previousState: { runId: null, text: '' },
    })

    const afterToolPhase = advanceStickyStreamingText({
      isStreaming: true,
      runId: 'run-1',
      rawText: '',
      smoothedText: '',
      previousState: afterText,
    })

    expect(afterToolPhase).toEqual({
      runId: 'run-1',
      text: 'Working through the task',
    })
  })

  it('resets sticky text when a new run starts', () => {
    const next = advanceStickyStreamingText({
      isStreaming: true,
      runId: 'run-2',
      rawText: '',
      smoothedText: '',
      previousState: { runId: 'run-1', text: 'Old stream text' },
    })

    expect(next).toEqual({ runId: 'run-2', text: '' })
  })

  it('clears sticky text when streaming ends', () => {
    const next = advanceStickyStreamingText({
      isStreaming: false,
      runId: null,
      rawText: '',
      smoothedText: '',
      previousState: { runId: 'run-1', text: 'Old stream text' },
    })

    expect(next).toEqual({ runId: null, text: '' })
  })
})

describe('response wait detection', () => {
  it('treats persisted complete runs as terminal', () => {
    expect(isTerminalActiveRunStatus('complete')).toBe(true)
    expect(isTerminalActiveRunStatus('completed')).toBe(true)
    expect(isTerminalActiveRunStatus('active')).toBe(false)
  })

  it('clears waiting when a new assistant message appears after the send snapshot', () => {
    const snapshot = createResponseWaitSnapshot([
      {
        role: 'user',
        content: [{ type: 'text', text: 'remember that i like cheesecake' }],
      },
    ])

    expect(
      shouldClearWaitingForAssistantMessage(
        [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'remember that i like cheesecake' },
            ],
          },
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Remembered: you like cheesecake.' },
            ],
            id: 'assistant-1',
          },
        ],
        snapshot,
      ),
    ).toBe(true)
  })
})

describe('stream cancellation on navigation', () => {
  const activeSend = {
    sessionKey: 'thread-123',
    friendlyId: 'thread-123',
  }

  it('preserves the first response while a new chat resolves to its saved thread', () => {
    expect(
      shouldCancelStreamOnNavigation(
        { activeCanonicalKey: null, activeFriendlyId: 'new', isNewChat: true },
        {
          activeCanonicalKey: null,
          activeFriendlyId: 'thread-123',
          isNewChat: false,
        },
        activeSend,
      ),
    ).toBe(false)
  })

  it('preserves the response while the active thread canonical key resolves', () => {
    expect(
      shouldCancelStreamOnNavigation(
        {
          activeCanonicalKey: null,
          activeFriendlyId: 'thread-123',
          isNewChat: false,
        },
        {
          activeCanonicalKey: 'thread-123',
          activeFriendlyId: 'thread-123',
          isNewChat: false,
        },
        activeSend,
      ),
    ).toBe(false)
  })

  it('cancels when the user navigates to another thread', () => {
    expect(
      shouldCancelStreamOnNavigation(
        {
          activeCanonicalKey: 'thread-123',
          activeFriendlyId: 'thread-123',
          isNewChat: false,
        },
        {
          activeCanonicalKey: 'thread-456',
          activeFriendlyId: 'thread-456',
          isNewChat: false,
        },
        activeSend,
      ),
    ).toBe(true)
  })

  it('cancels when a new-chat transition resolves to a different thread', () => {
    expect(
      shouldCancelStreamOnNavigation(
        { activeCanonicalKey: null, activeFriendlyId: 'new', isNewChat: true },
        {
          activeCanonicalKey: null,
          activeFriendlyId: 'thread-456',
          isNewChat: false,
        },
        activeSend,
      ),
    ).toBe(true)
  })
})
