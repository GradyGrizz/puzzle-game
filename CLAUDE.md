# DELVE — project notes for Claude

## Live site
The game is served from the `master` branch via GitHub Pages at:
**https://gradygrizz.github.io/puzzle-game**

Deploy flow: commit on the dev branch → `git checkout master` →
`git merge --ff-only <dev-branch>` → `git push origin master`.

## Response convention
ALWAYS end every reply to the user with BOTH of these links:
- Live site (GitHub Pages): https://gradygrizz.github.io/puzzle-game
- Upload files to the repo: https://github.com/gradygrizz/puzzle-game/upload/master
