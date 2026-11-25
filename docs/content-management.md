# Workspace content management

ClipFlow stores drafts, selected channels and uploaded media inside the active workspace. Content actions must verify workspace ownership before reading or changing a post, media asset or connected social account.

Draft scheduling records a UTC timestamp and changes a draft to the scheduled state only when it still belongs to the workspace, remains a draft and has a valid future time. The update and its audit event are committed together.

The calendar displays scheduled posts and drafts awaiting a schedule. It is a planning view; actual publication is performed by the separately supervised background worker and verified platform adapters.
