# dsh-session-remover

Adds "Delete conversation" and "Batch delete…" to the sidebar session row "…" menu, moving a conversation and its subagent sessions into the Windows recycle bin, from which they can be restored.

- Package: `dsh-session-remover`
- Repository: <https://github.com/sailoumili/dsh-session-remover>
- Compatible with DSH 0.1.7 and later; available for the web and desktop editions
- Interface text follows the DSH interface language; Chinese and English are both provided
- Windows only; no third-party runtime dependencies

## Installation

### Web

1. Click **Plugins** in the left sidebar.
2. Click **Add plugin**.
3. Enter `dsh-session-remover` in the package field, click **Install**, and wait for the installation to complete.
4. Enable the plugin on its page.
5. Restart DSH.

Equivalent command line:

```cmd
dsh plugin --profile web add dsh-session-remover
```

### Desktop

The desktop edition uses a separate plugin manifest (`~/.dsh/profiles/desktop`) and is independent of the web edition, so it requires a separate installation. The steps are identical: sidebar **Plugins** → **Add plugin** → enter the package name → **Install** → enable → restart.

```cmd
dsh plugin --profile desktop add dsh-session-remover
```

## Usage

1. Move the pointer over any sidebar session row and click the "…" at the end of the row.
2. The last two menu items are "Delete conversation" and "Batch delete…".
3. Single delete: click "Delete conversation", click **OK** in the confirmation dialog; the page reloads automatically and the row disappears.
4. Batch delete: click "Batch delete…", tick the target conversations in the panel (select all / select none are available), tick the acknowledgement, click the delete button, and confirm once more; deletion then proceeds row by row.
5. Leaving batch delete: "Cancel", "Close", clicking outside the panel, or pressing `Esc` all work. While a deletion is in progress, closing is not honoured until it finishes.
6. Restore: open the recycle bin in File Explorer, right-click the session folder, choose Restore, then restart DSH.

## Notes

- **Deletion moves the data to the recycle bin; it does not erase it.** The move stays on the same volume, so no data is copied and nothing is left behind in `.dsh`. Before deleting, the plugin checks whether the recycle bin is disabled for the volume that holds the session (Windows stores this setting per drive); if "Don't move files to the Recycle Bin. Remove files immediately when deleted" is ticked, the plugin **refuses to delete** rather than falling back to permanent deletion. Afterwards each item is verified in the recycle bin by original location and name.
- **Subagent sessions are removed together.** Subagent sessions are not shown in the sidebar or search, so they accumulate unless removed together. Forked conversations are independent and are **never** deleted along with their source.
- **Three records are cleaned:** the projection cache, the workspace registry, and the archived set. The projection cache is derived data that DSH rebuilds after a restore; the other two are cleared to avoid leaving traces locally, at the cost of a restored conversation being filed under "Ungrouped" in the sidebar.
- **Deleting the currently open conversation is supported.** Its running task is stopped and flushed to disk first, and no DSH restart is required.

## Known limitations

- **Windows only.** Moving to the recycle bin relies on the system script host `cscript.exe`, which ships with Windows; on other systems the plugin refuses to delete and reports an error rather than falling back to permanent deletion.
- **An emptied recycle bin cannot be restored.** The plugin only moves the files into the bin; whether to empty it is the user's decision. The bin also has a size cap, and Windows discards the oldest entries once the quota is exceeded.
- **A restored conversation may not be in its original workspace.** The plugin clears the workspace registry entry, so a restored conversation appears under "Ungrouped". To restore it to its original workspace, edit `~/.dsh/storages/workspace.json` by hand while DSH is stopped.
- **Attachments are not reclaimed.** DSH attachments are content-addressed, shared across conversations, and carry no reference counting, so the plugin cannot safely determine whether they can be reclaimed.
- **On a failed delete, the reason text returned by the server also follows the interface language**: the server returns only an error code and parameters, and the interface text is resolved by the front end in the active language.
- **The endpoint accepts loopback requests only.** `/api/session.delete` allows only `127.0.0.1` / `localhost` / `[::1]` and returns 403 for LAN origins. The plugin registers its route outside the official authentication fence, while the official browser-cookie check depends on a signing secret the plugin cannot obtain; deleting data is high-risk, so it fails closed. If DSH is bound to `0.0.0.0` and accessed from another machine, deletion returns 403.
- **Nothing is touched when the session directory cannot be read.** A failed session-tree scan aborts the deletion as a whole and never treats "read failure" as "absent from disk".
- The batch delete panel does not trap focus; `Tab` may move to page elements behind the panel.

## License

MIT
