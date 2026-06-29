// The leaderboard computation is shared with the extension host. Re-export it
// under the name the webview already imports (used when reloading saved runs).
export { computeLeaderboard as computeClientLeaderboard } from '../../src/shared/leaderboard';
