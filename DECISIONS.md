# Decisions

- Top-level files grouped by last edit (Today, Yesterday, Previous 7 days, Previous 30 days, then one group per month). Why: hundreds of loose files cluttered the Files view; month groups keep old files compressed instead of one huge "Older" bucket.
- Only top-level files are grouped; folders stay above, unchanged. Why: files inside folders are already organized by the user.
- Today + Yesterday open by default, older groups closed. Why: recent work stays one click away, the rest collapses.
- Modified time comes from OPFS/disk `File.lastModified` in `fs.worker.ts` walk. Why: no extra metadata store needed.
