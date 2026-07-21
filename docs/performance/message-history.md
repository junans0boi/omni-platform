# Message history performance contract

Issue: [#24](https://github.com/junans0boi/omni-platform/issues/24)

## Budgets

- Cursor API: 50 messages by default, 100 maximum per request.
- Client retention: at most 500 normalized, de-duplicated messages per active channel.
- Rendering: viewport plus 8 rows of overscan; a 10,000-message fixture must keep no more than 30 message rows in the DOM.
- Cold fixture navigation: under 5 seconds on CI, including development-server route compilation.
- End-to-end scroll: under 1 second on CI.
- Hidden document or collapsed Voice grid: no attached video elements. Remote audio remains attached.

These are regression ceilings, not target user timings. Tightening them requires recording results on the same runner class.

## Evidence

Before #24, the dashboard mapped every fetched message directly to a DOM node, selected the complete Zustand store, scrolled to the bottom after every message mutation, and kept LiveKit video attached when the document was hidden.

After #24:

- `useBoundedVirtualList` dynamically measures variable-height rows and renders only the visible range plus overscan.
- Cursor prepends restore the prior first message as the scroll anchor; appends scroll only when the reader is already near the bottom.
- Message and Voice consumers use narrow shallow Zustand selectors.
- `visibilitychange` detaches local and remote video while the audio attachment effect remains active.
- `tests/e2e/message-performance.spec.ts` passes with 10,000 mixed-height messages: 30 or fewer DOM rows, initial navigation below 5 seconds, and full-range scroll below 1 second.
- `tests/livekit/livekit.spec.ts` asserts hidden-tab video detachment, visible-tab recovery, and uninterrupted remote audio subscription against LiveKit.

## Reproduce

```sh
npm run test:e2e
npm run test:livekit
```

The fixture route exists only under the Next development server and returns 404 in production builds.
